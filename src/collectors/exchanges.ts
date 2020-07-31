import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

export default class ExchangesCollector extends BaseCollector {
  protected async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, number } = this.epoch;
    const accounts = await this.kit.contracts.getAccounts();
    const exchange = await this.kit.contracts.getExchange();

    const keys = await this.addresses.allKnownAddresses(accounts);

    // @ts-ignore: access protected property
    const events = await exchange.getPastEvents('Exchanged', {
      fromBlock: firstBlock,
      toBlock: lastBlock,
      filter: {
        exchanger: keys,
      },
    });

    const rewards: Rewards = [];
    await concurrentMap(5, events, async (event) => {
      const { exchanger, sellAmount, buyAmount, soldGold } = event.returnValues;
      this.log(`Fetching exchanges for ${exchanger}`);
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);
      // The Buy Credit
      rewards.push({
        address: exchanger,
        alias: this.addresses.lookupAlias(exchanger),
        group: this.addresses.groupForAddress(exchanger),
        amount: this.toEth(buyAmount, { numeric: true }),
        amount_wei: this.toNumeric(buyAmount),
        currency: soldGold ? 'cUSD' : 'CELO',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        rewards_category: 'exchange',
        rewards_type: 'credit',
      });
      // The Sell Debit
      rewards.push({
        address: exchanger,
        alias: this.addresses.lookupAlias(exchanger),
        group: this.addresses.groupForAddress(exchanger),
        amount: this.toEth(sellAmount, { numeric: true, negative: true }),
        amount_wei: this.toNumeric(sellAmount, { negative: true }),
        currency: soldGold ? 'CELO' : 'cUSD',
        epoch: number,
        block: lastBlock,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        rewards_category: 'exchange',
        rewards_type: 'debit',
      });
    });

    return rewards;
  }
}
