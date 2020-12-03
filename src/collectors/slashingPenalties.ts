import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

export default class SlashingPenaltiesCollector extends BaseCollector {
  protected async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, number } = this.epoch;
    const lockedGold = await this.kit.contracts.getLockedGold();

    const slashable = [...this.addresses.allGroupOwners(), ...this.addresses.allValidators()];

    // @ts-ignore: access protected property
    const events = await lockedGold.getPastEvents('AccountSlashed', {
      fromBlock: firstBlock,
      toBlock: lastBlock,
      filter: {
        slashed: slashable,
      },
    });

    const rewards: Rewards = [];
    await concurrentMap(5, events, async (event) => {
      const { slashed, penalty } = event.returnValues;
      this.log(`Fetching slashing penalties for ${slashed}`);
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);
      rewards.push({
        address: slashed,
        alias: this.addresses.lookupAlias(slashed),
        group: this.addresses.groupForAddress(slashed, true),
        amount: this.toEth(penalty, { numeric: true, negative: true }),
        amount_wei: this.toNumeric(penalty, { negative: true }),
        currency: 'CELO',
        epoch: number,
        block: event.blockNumber,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        category: 'slashingPenalty',
        type: 'debit',
      });
    });

    return rewards;
  }
}
