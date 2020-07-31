import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

export default class SlashingRewardsCollector extends BaseCollector {
  protected async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, number } = this.epoch;
    const lockedGold = await this.kit.contracts.getLockedGold();
    const accounts = await this.kit.contracts.getAccounts();

    // @ts-ignore: access protected property
    const events = await lockedGold.getPastEvents('AccountSlashed', {
      fromBlock: firstBlock,
      toBlock: lastBlock,
      filter: {
        reporter: await this.addresses.allKnownAddresses(accounts),
      },
    });

    const rewards: Rewards = [];
    await concurrentMap(5, events, async (event) => {
      const { reporter, reward } = event.returnValues;
      this.log(`Fetching slashing rewards for ${reporter}`);
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);
      rewards.push({
        address: reporter,
        alias: this.addresses.lookupAlias(reporter),
        group: undefined,
        amount: this.toEth(reward, { numeric: true }),
        amount_wei: this.toNumeric(reward),
        currency: 'CELO',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        rewards_category: 'slashingReward',
        rewards_type: 'credit',
      });
    });

    return rewards;
  }
}
