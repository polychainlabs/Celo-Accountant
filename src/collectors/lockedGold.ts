import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

export default class LockedGoldCollector extends BaseCollector {
  protected async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, number } = this.epoch;
    const accounts = await this.kit.contracts.getAccounts();
    const lockedGold = await this.kit.contracts.getLockedGold();

    const keys = await this.addresses.allKnownAddresses(accounts);

    // @ts-ignore: access protected property
    const lockedEvents = await lockedGold.getPastEvents('GoldLocked', {
      fromBlock: firstBlock,
      toBlock: lastBlock,
      filter: {
        account: keys,
      },
    });

    // @ts-ignore: access protected property
    const withdrawnEvents = await lockedGold.getPastEvents('GoldWithdrawn', {
      fromBlock: firstBlock,
      toBlock: lastBlock,
      filter: {
        account: keys,
      },
    });

    const rewards: Rewards = [];

    await concurrentMap(5, lockedEvents, async (event) => {
      const { account, value } = event.returnValues;
      this.log(`Fetching lockedGold events for ${account}`);
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);

      rewards.push({
        address: account,
        alias: this.addresses.lookupAlias(account),
        group: this.addresses.groupForAddress(account),
        amount: this.toEth(value, { numeric: true }),
        amount_wei: this.toNumeric(value),
        currency: 'CELO',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        rewards_category: 'goldLocked',
        rewards_type: 'credit',
      });
    });

    await concurrentMap(5, withdrawnEvents, async (event) => {
      const { account, value } = event.returnValues;
      this.log(`Fetching lockedGold withdrawn events for ${account}`);
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);

      rewards.push({
        address: account,
        alias: this.addresses.lookupAlias(account),
        group: this.addresses.groupForAddress(account),
        amount: this.toEth(value, { numeric: true, negative: true }),
        amount_wei: this.toNumeric(value, { negative: true }),
        currency: 'CELO',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        rewards_category: 'lockedGoldWithdrawn',
        rewards_type: 'debit',
      });
    });

    return rewards;
  }
}
