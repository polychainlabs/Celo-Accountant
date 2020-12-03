import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

// Tracks CELO transfers
export default class NativeTokenCollector extends BaseCollector {
  async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, number } = this.epoch;
    const accounts = await this.kit.contracts.getAccounts();
    const goldToken = await this.kit.contracts.getGoldToken();

    const keys = await this.addresses.allKnownAddresses(accounts);

    // @ts-ignore: access protected property
    const transfersTo = await goldToken.getPastEvents('Transfer', {
      fromBlock: firstBlock,
      toBlock: lastBlock - 1,
      filter: {
        to: keys,
      },
    });

    // @ts-ignore: access protected property
    const transfersFrom = await goldToken.getPastEvents('Transfer', {
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
      // Transfers to our addresses
      rewards.push({
        address: to,
        alias: this.addresses.lookupAlias(to),
        group: this.addresses.groupForAddress(to),
        amount: this.toEth(value, { numeric: true }),
        amount_wei: this.toNumeric(value),
        currency: 'CELO',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        category: 'Transfer',
        type: 'credit',
      });
    });

    await concurrentMap(5, transfersFrom, async (event) => {
      const { from, value } = event.returnValues;
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);
      // Transfers from our addresses
      rewards.push({
        address: from,
        alias: this.addresses.lookupAlias(from),
        group: this.addresses.groupForAddress(from),
        amount: this.toEth(value, { numeric: true, negative: true }),
        amount_wei: this.toNumeric(value, { negative: true }),
        currency: 'CELO',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        category: 'Transfer',
        type: 'debit',
      });
    });

    return rewards;
  }
}
