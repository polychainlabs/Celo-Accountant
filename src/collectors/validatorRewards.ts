import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

export default class ValidatorRewardsCollector extends BaseCollector {
  protected async collect(): Promise<Rewards> {
    const { lastBlock, lastBlockTime, lastBlockDate, number } = this.epoch;
    const rewards: Rewards = [];

    const validators = await this.kit.contracts.getValidators();

    await concurrentMap(5, this.addresses.allValidators(), async (validator) => {
      this.log(`Fetching validator rewards for ${validator}`);
      // @ts-ignore: access protected property
      const events = await validators.getPastEvents('ValidatorEpochPaymentDistributed', {
        fromBlock: lastBlock,
        toBlock: lastBlock,
        filter: {
          validator: validator,
        },
      });

      if (events.length > 1) {
        this.log({
          message: `Validator ${validator} received multiple payouts during epoch ${number}`,
          address: validator,
          investigate: 'true',
          events: events,
        });
      }

      events.forEach((event) => {
        const { group, validatorPayment, groupPayment } = event.returnValues;
        rewards.push({
          address: validator,
          alias: this.addresses.lookupAlias(validator),
          group: group,
          amount: this.toEth(validatorPayment, { numeric: true }),
          amount_wei: this.toNumeric(validatorPayment),
          currency: 'cUSD',
          epoch: number,
          block: lastBlock,
          earned_at: lastBlockTime,
          earned_date: lastBlockDate,
          category: 'validator',
          type: 'credit',
        });
        rewards.push({
          address: group,
          alias: this.addresses.lookupAlias(group),
          group: group,
          amount: this.toEth(groupPayment, { numeric: true }),
          amount_wei: this.toNumeric(groupPayment),
          currency: 'cUSD',
          epoch: number,
          block: lastBlock,
          earned_at: lastBlockTime,
          earned_date: lastBlockDate,
          category: 'group',
          type: 'credit',
        });
      });
    });

    return rewards;
  }
}
