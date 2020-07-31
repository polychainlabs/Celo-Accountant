import { ContractKit } from '@celo/contractkit';
import { concurrentMap } from './common/concurrentMap';
import { MonitoredAddresses } from './addresses';
import { KitProvider } from './common/kitProvider';
import BQ from './common/bigquery';
import logger from './common/log';
import { timestampFromBlockTime } from './common/utils';
import { execTime } from './common/decorators';
import AttestationFeesCollector from './collectors/attestationFees';
import ExchangesCollector from './collectors/exchanges';
import LockedGoldCollector from './collectors/lockedGold';
import SlashingPenaltiesCollector from './collectors/slashingPenalties';
import SlashingRewardsCollector from './collectors/slashingRewards';
import StableTokenCollector from './collectors/stableToken';
import NativeTokenCollector from './collectors/nativeToken';
import TrxnsCollector from './collectors/trxns';
import ValidatorRewardsCollector from './collectors/validatorRewards';
import VoterRewardsCollector from './collectors/voterRewards';
import Reconciler from './reconciler';
import {
  AddressSet,
  Addresses,
  Reconciliations,
  CollectorArgs,
  Epoch,
  Rewards,
} from './common/types';

export default class Accountant {
  protected client: ContractKit;
  protected addresses: Addresses;
  protected database: BQ;

  protected currentRevision!: number;

  constructor(client: ContractKit, addresses: Addresses, database: BQ) {
    this.client = client;
    this.addresses = addresses;
    this.database = database;
  }

  async setup(): Promise<void> {
    if (this.currentRevision && this.currentRevision !== 0) {
      return;
    }

    this.currentRevision = await this.database.currentRevision();
    if (this.currentRevision === 0) {
      this.currentRevision = await this.database.createRevision();
    }
  }

  async processLatestEpoch(): Promise<void> {
    const currentEpoch = await this.currentEpoch();
    await this.processEpoch(currentEpoch - 1);
  }

  @execTime
  async processEpoch(epochNumber: number): Promise<void> {
    await this.setup();

    // Make sure we haven't already processed this epoch
    if (!(await this.epochCompleted(epochNumber))) {
      this.log({
        message: `Epoch ${epochNumber} has not completed yet, exiting`,
        epoch: epochNumber,
      });
      return;
    }

    if (await this.database.epochProcessed(epochNumber, this.currentRevision)) {
      this.log({ message: `Epoch ${epochNumber} already processed, exiting`, epoch: epochNumber });
      return;
    }

    this.log({ message: `Processing rewards for epoch ${epochNumber}`, epoch: epochNumber });

    const recordsToInsert = await this.collectRewards(epochNumber);

    await this.loadRewards(recordsToInsert);
    this.log({
      message: `Loaded ${recordsToInsert.length} rewards for epoch ${epochNumber}`,
      epoch: epochNumber,
    });

    await this.reconcile(epochNumber);
  }

  @execTime
  async backfillAddresses(epochNumber: number): Promise<void> {
    await this.setup();

    if (!(await this.epochCompleted(epochNumber))) {
      this.log({
        message: `Epoch ${epochNumber} has not completed yet, exiting`,
        epoch: epochNumber,
      });
      return;
    }

    this.log({ message: `Backfilling rewards for epoch ${epochNumber}`, epoch: epochNumber });

    const recordsToInsert = await this.collectRewards(epochNumber);

    const recordsByAddress = recordsToInsert.reduce(
      (addresses: { [address: string]: Rewards }, record) => {
        (addresses[record.address] = addresses[record.address] || []).push(record);
        return addresses;
      },
      {},
    );

    await concurrentMap(5, Object.values(recordsByAddress), async (records) => {
      const { epoch, address } = records[0];
      try {
        await this.database.loadRewardsForAddress(records, this.currentRevision);
        this.log({
          message: `Loaded ${records.length} rewards for ${address} in epoch ${epoch}`,
          epoch,
          address,
        });
      } catch (error) {
        this.log({
          message: `Could not load rewards for ${address} in epoch ${epoch}`,
          investigate: true,
          epoch,
          address,
          errors: error.errors,
        });
        error.errors.forEach(console.error);
        throw new Error(`Could not load rewards for ${address} in epoch ${epoch}`);
      }
    });

    await this.reconcile(epochNumber);
  }

  async collectRewards(epochNumber: number): Promise<Rewards> {
    // Ensure we have a current revision
    await this.setup();

    const epoch = await this.getEpochData(epochNumber);
    const args: CollectorArgs = {
      kit: this.client,
      epoch: epoch,
      addresses: this.addresses,
    };
    const attestationFees = await new AttestationFeesCollector(args).run();
    const exchanges = await new ExchangesCollector(args).run();
    const lockedGold = await new LockedGoldCollector(args).run();
    const slashingPenalties = await new SlashingPenaltiesCollector(args).run();
    const slashingRewards = await new SlashingRewardsCollector(args).run();
    const stableTokenTransfers = await new StableTokenCollector(args).run();
    const nativeTokenTransfers = await new NativeTokenCollector(args).run();
    const validatorRewards = await new ValidatorRewardsCollector(args).run();
    const trxns = await new TrxnsCollector(args).run();
    const voterRewards = await new VoterRewardsCollector(args).run();

    return [
      ...attestationFees,
      ...exchanges,
      ...lockedGold,
      ...slashingPenalties,
      ...slashingRewards,
      ...stableTokenTransfers,
      ...nativeTokenTransfers,
      ...trxns,
      ...validatorRewards,
      ...voterRewards,
    ];
  }

  protected async loadRewards(rewards: Rewards): Promise<void> {
    if (rewards.length === 0) {
      return;
    }

    // Ensure we have a current revision
    await this.setup();

    try {
      await this.database.loadRewards(rewards, this.currentRevision);
    } catch (error) {
      this.log({
        message: `Could not load rewards for epoch ${rewards[0].epoch}`,
        epoch: rewards[0].epoch,
        investigate: true,
        errors: error.errors,
      });
      error.errors.forEach(console.error);
      throw new Error(`Could not load rewards for epoch ${rewards[0].epoch}`);
    }
  }

  async reconcile(epochNumber?: number | undefined): Promise<Reconciliations> {
    // Ensure we have a current revision
    await this.setup();

    epochNumber = epochNumber || (await this.database.lastEpochProcessed(this.currentRevision));
    const blockNumber = await this.client.getLastBlockNumberForEpoch(epochNumber);

    this.log(`Running reconciliation for epoch ${epochNumber}`);
    const params = {
      kit: this.client,
      epoch: epochNumber,
      blockNumber: blockNumber,
      revision: this.currentRevision,
      database: this.database,
      addresses: this.addresses,
    };

    return await new Reconciler(params).run();
  }

  protected async getEpochData(epoch: number): Promise<Epoch> {
    const firstBlockNumber = await this.client.getFirstBlockNumberForEpoch(epoch);
    const lastBlockNumber = await this.client.getLastBlockNumberForEpoch(epoch);
    const lastBlock = await this.client.web3.eth.getBlock(lastBlockNumber);
    const blockTime = timestampFromBlockTime(lastBlock.timestamp);

    return {
      number: epoch,
      firstBlock: firstBlockNumber,
      lastBlock: lastBlockNumber,
      lastBlockTime: blockTime,
      lastBlockDate: blockTime.slice(0, 10),
    };
  }

  protected async epochCompleted(epoch: number): Promise<boolean> {
    return epoch < (await this.currentEpoch());
  }

  protected async currentEpoch(): Promise<number> {
    const currentBlock = await this.client.web3.eth.getBlock('latest');
    const currentEpoch = await this.client.getEpochNumberOfBlock(currentBlock.number);

    return currentEpoch;
  }

  protected log(loggable: unknown): void {
    logger(loggable, { class: this.constructor.name, revision: this.currentRevision });
  }

  public static async conjure(addresses?: AddressSet | undefined): Promise<Accountant> {
    const addressSet = new MonitoredAddresses(addresses);
    const kit = new KitProvider().getKit();
    const bigquery = new BQ();
    const accountant = new Accountant(kit, addressSet, bigquery);

    return accountant;
  }
}
