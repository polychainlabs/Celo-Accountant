import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

export default class StableTokenCollector extends BaseCollector {
  protected async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, number } = this.epoch;
    const accounts = await this.kit.contracts.getAccounts();
    const stableToken = await this.kit.contracts.getStableToken();

    const keys = await this.addresses.allKnownAddresses(accounts);

    // @ts-ignore: access protected property
    const transfersTo = await stableToken.getPastEvents('Transfer', {
      fromBlock: firstBlock,
      toBlock: lastBlock - 1,
      filter: {
        to: keys,
      },
    });

    // @ts-ignore: access protected property
    const transfersFrom = await stableToken.getPastEvents('Transfer', {
      fromBlock: firstBlock,
      toBlock: lastBlock,
      filter: {
        from: keys,
      },
    });

    const rewards: Rewards = [];
    await concurrentMap(5, transfersTo, async (event) => {
      const { to, value } = event.returnValues;
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);
      // The Buy Credit
      rewards.push({
        address: to,
        alias: this.addresses.lookupAlias(to),
        group: this.addresses.groupForAddress(to),
        amount: this.toEth(value, { numeric: true }),
        amount_wei: this.toNumeric(value),
        currency: 'cUSD',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        category: 'cUSDTransfer',
        type: 'credit',
      });
    });

    await concurrentMap(5, transfersFrom, async (event) => {
      const { from, value } = event.returnValues;
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);
      // The Buy Credit
      rewards.push({
        address: from,
        alias: this.addresses.lookupAlias(from),
        group: this.addresses.groupForAddress(from),
        amount: this.toEth(value, { numeric: true, negative: true }),
        amount_wei: this.toNumeric(value, { negative: true }),
        currency: 'cUSD',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        category: 'cUSDTransfer',
        type: 'debit',
      });
    });

    return rewards;
  }
}
