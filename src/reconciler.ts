import { ContractKit } from '@celo/contractkit';
import logger from './common/log';
import { concurrentMap } from './common/concurrentMap';
import { LockedGoldWrapper } from '@celo/contractkit/lib/wrappers/LockedGold.d';
import { StableTokenWrapper } from '@celo/contractkit/lib/wrappers/StableTokenWrapper.d';
import BQ from './common/bigquery';
import BN from 'bn.js';
import BigNumber from 'bignumber.js';
import {
  Addresses,
  AddressBalances,
  Reconciliation,
  Reconciliations,
  ReconcilerArgs,
} from './common/types';
import { execTime } from './common/decorators';

export default class Reconciler {
  protected kit: ContractKit;
  protected database: BQ;
  protected epoch: number;
  protected blockNumber: number;
  protected revision: number;
  protected addresses: Addresses;

  constructor(args: ReconcilerArgs) {
    this.kit = args.kit;
    this.epoch = args.epoch;
    this.blockNumber = args.blockNumber;
    this.revision = args.revision;
    this.database = args.database;
    this.addresses = args.addresses;
  }

  @execTime
  async run(): Promise<Reconciliations> {
    try {
      const results = await this.reconcile();
      const summary = this.summarize(results);

      return results.filter((result) => result.mismatch).concat(summary);
    } catch (error) {
      console.error(error);
      this.log({
        message: `Unable to reconcile rewards for epoch ${this.epoch}`,
        investigate: 'true',
        error: error.message,
      });
      return [];
    }
  }

  async reconcile(): Promise<Reconciliations> {
    const accounts = await this.kit.contracts.getAccounts();
    const lockedGold = await this.kit.contracts.getLockedGold();
    const stableToken = await this.kit.contracts.getStableToken();
    const keys = await this.addresses.allKnownAddresses(accounts);

    const calculatedBalances = await this.database.getCalculatedBalances(this.epoch, this.revision);

    const balances = await concurrentMap(5, keys, async (address) => {
      try {
        const liquidGoldBalance = await this.getLiquidGoldBalance(address, this.blockNumber);
        const lockedGoldBalance = await this.getLockedGoldBalance(
          lockedGold,
          address,
          this.blockNumber,
        );
        const stableTokenBalance = await this.getUSDBalance(stableToken, address, this.blockNumber);
        const totalGoldBalance = new BN(liquidGoldBalance)
          .add(new BN(lockedGoldBalance))
          .toString();

        const calculatedGoldBalance = this.getCalculatedBalance(
          calculatedBalances,
          address,
          'CELO',
        );
        const calculatedUSDBalance = this.getCalculatedBalance(calculatedBalances, address, 'cUSD');

        const goldDifference = new BN(totalGoldBalance).sub(new BN(calculatedGoldBalance));
        const usdDifference = new BN(stableTokenBalance).sub(new BN(calculatedUSDBalance));

        const goldMatches = goldDifference.abs().gtn(0);
        const usdMatches = usdDifference.abs().gtn(0);

        const reconciliation: Reconciliation = {
          address,
          alias: this.addresses.lookupAlias(address),
          onChainGold: totalGoldBalance,
          calculatedGold: calculatedGoldBalance,
          onChainLiquidGold: liquidGoldBalance,
          onChainLockedGold: lockedGoldBalance,
          goldDifference: this.toEth(goldDifference.toString()),
          onChainUSD: stableTokenBalance,
          calculatedUSD: calculatedUSDBalance,
          usdDifference: this.toEth(usdDifference.toString()),
          mismatch: !goldMatches || !usdMatches,
          epoch: this.epoch,
        };

        this.log({
          message: 'Address reconciliation result',
          ...reconciliation,
        });

        return reconciliation;
      } catch (error) {
        console.error(error);
        this.log({
          message: `Unable to run reconciliation for ${address}`,
          address,
          investigate: true,
          error: error.message,
        });

        return;
      }
    });

    return balances
      .filter((item): item is Reconciliation => typeof item !== 'undefined')
      .sort((a, b) => Number(b.goldDifference) - Number(a.goldDifference));
  }

  protected summarize(results: Reconciliations): Reconciliation {
    const overallTemplate: Reconciliation = {
      address: 'Overall',
      alias: 'Overall',
      onChainGold: '0',
      calculatedGold: '0',
      onChainLiquidGold: '0',
      onChainLockedGold: '0',
      goldDifference: '0',
      onChainUSD: '0',
      calculatedUSD: '0',
      usdDifference: '0',
      mismatch: false,
      epoch: this.epoch,
    };

    const summary = results.reduce((overall, item) => {
      this.addField(overall, item, 'onChainGold');
      this.addField(overall, item, 'calculatedGold');
      this.addField(overall, item, 'onChainLiquidGold');
      this.addField(overall, item, 'onChainLockedGold');
      this.addField(overall, item, 'goldDifference');
      this.addField(overall, item, 'onChainUSD');
      this.addField(overall, item, 'calculatedUSD');
      this.addField(overall, item, 'usdDifference');
      return overall;
    }, overallTemplate);

    this.log({
      message: 'Overall Reconciliation Result',
      ...summary,
    });

    return summary;
  }

  protected addField(
    a: Reconciliation,
    b: Reconciliation,
    field: keyof Reconciliation,
  ): Reconciliation {
    a[field] = new BigNumber(a[field]).plus(new BigNumber(b[field])).toFixed();
    return a;
  }

  protected getCalculatedBalance(
    balances: AddressBalances,
    address: string,
    currency: 'CELO' | 'cUSD',
  ): string {
    if (address in balances) {
      // The value here is actually a Big.js instance
      return balances[address][currency].toFixed();
    }
    return '0';
  }

  protected log(loggable: unknown): void {
    logger(loggable, {
      class: this.constructor.name,
      epoch: this.epoch,
      revision: this.revision,
    });
  }

  async getLiquidGoldBalance(address: string, blockNumber: number): Promise<string> {
    try {
      const balance = await this.kit.web3.eth.getBalance(address, blockNumber);
      return balance;
    } catch (error) {
      if (error.message.match(/missing trie node/)) {
        this.log({
          message: `Could not fetch balance for ${address} at block ${blockNumber} due to missing trie node`,
          address,
          blockNumber,
          investigate: true,
          error: error.message,
        });
      } else {
        console.error(error);
      }
      return '0';
    }
  }

  async getLockedGoldBalance(
    lockedGold: LockedGoldWrapper,
    address: string,
    blockNumber: number,
  ): Promise<string> {
    try {
      // @ts-ignore: access protected property
      const lockedBalance = await lockedGold.contract.methods
        .getAccountTotalLockedGold(address)
        .call({}, blockNumber);

      // @ts-ignore: access protected property
      const pendingBalance = await lockedGold.contract.methods
        .getTotalPendingWithdrawals(address)
        .call({}, blockNumber);

      return new BN(lockedBalance).add(new BN(pendingBalance)).toString();
    } catch (error) {
      if (error.message.match(/missing trie node/)) {
        this.log({
          message: `Could not fetch lockedGold balance for ${address} at block ${blockNumber} due to missing trie node`,
          address,
          blockNumber,
          investigate: true,
          error: error.message,
        });
      } else {
        console.error(error);
      }
      return '0';
    }
  }

  async getUSDBalance(
    stableToken: StableTokenWrapper,
    address: string,
    blockNumber: number,
  ): Promise<string> {
    try {
      // @ts-ignore: access protected property
      const balance = await stableToken.contract.methods.balanceOf(address).call({}, blockNumber);
      return balance;
    } catch (error) {
      if (error.message.match(/missing trie node/)) {
        this.log({
          message: `Could not fetch stableToken balance for ${address} at block ${blockNumber} due to missing trie node`,
          address,
          blockNumber,
          investigate: true,
          error: error.message,
        });
      } else {
        console.error(error);
      }
      return '0';
    }
  }

  protected toEth(amount: string): string {
    return this.kit.web3.utils.fromWei(amount, 'ether');
  }
}
