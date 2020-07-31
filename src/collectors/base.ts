import { ContractKit } from '@celo/contractkit';
import logger from '../common/log';
import { timestampFromBlockTime, dateFromBlockTime } from '../common/utils';
import { Addresses, Epoch, CollectorArgs, Rewards } from '../common/types';
import { execTime } from '../common/decorators';

export default abstract class BaseCollector {
  protected kit: ContractKit;
  protected epoch: Epoch;
  protected addresses: Addresses;

  constructor(args: CollectorArgs) {
    this.kit = args.kit;
    this.epoch = args.epoch;
    this.addresses = args.addresses;
  }

  @execTime
  async run(): Promise<Rewards> {
    try {
      const rewards = await this.collect();
      return rewards;
    } catch (error) {
      console.error(error);
      this.log({
        message: `Unable to collect ${this.constructor.name} rewards for epoch ${this.epoch.number}`,
        investigate: 'true',
        error: error.message,
      });

      if (error.message.match(/502 Server Error/)) {
        this.log({ message: `Node may be down, exiting run early` });
        process.exit(1);
      }

      return [];
    }
  }

  protected abstract async collect(): Promise<Rewards>;

  protected toEth(amount: string, { numeric = false, negative = false } = {}): string {
    const converted = this.kit.web3.utils.fromWei(amount, 'ether');

    const value = numeric ? this.toNumeric(converted, { warn: false }) : converted;
    return this.maybeNegative(value, negative);
  }

  // BigQuery Numeric Type can only support 9 decimal places
  // So this takes an amount and rounds to 9 decimal places
  protected toNumeric(amount: string, { negative = false, warn = true } = {}): string {
    const [number, decimals] = amount.split('.');
    if (typeof decimals === 'undefined') {
      return this.maybeNegative(amount, negative);
    }
    if (decimals.length <= 9) {
      return this.maybeNegative(amount, negative);
    }
    const rounded = Math.round(parseFloat(`${decimals.slice(0, 9)}.${decimals[9]}`));
    if (warn) {
      this.log({
        message: `Unexpected numeric rounding...`,
        amount: amount,
        rounded: `${number}.${rounded}`,
        investigate: 'true',
      });
    }

    const value = `${number}.${rounded}`;
    return this.maybeNegative(value, negative);
  }

  protected maybeNegative(value: string, negative: boolean): string {
    return negative ? `-${value}` : value;
  }

  // Simple proxy method
  protected timestampFromBlockTime(blockTime: number | string): string {
    return timestampFromBlockTime(blockTime);
  }

  // Simple proxy method
  protected dateFromBlockTime(blockTime: number | string): string {
    return dateFromBlockTime(blockTime);
  }

  protected log(loggable: unknown, investigate = false): void {
    const injected: Record<string, unknown> = {
      class: this.constructor.name,
      epoch: this.epoch.number,
    };

    if (investigate) {
      injected['investigate'] = true;
    }

    logger(loggable, injected);
  }
}
