import BaseCollector from './base';
import { Rewards } from '../common/types';
import { EventLog } from 'web3-core';
import BN from 'bn.js';
import BigNumber from 'bignumber.js';

export default class VoterRewardsCollector extends BaseCollector {
  async collect(): Promise<Rewards> {
    const { lastBlock, lastBlockTime, lastBlockDate, number } = this.epoch;

    const voterActivatedEvents = await this.getElectionEvents('ValidatorGroupVoteActivated', {
      account: this.addresses.allVoters(),
    });
    const voterRevokedEvents = await this.getElectionEvents('ValidatorGroupActiveVoteRevoked', {
      account: this.addresses.allVoters(),
    });
    const voterVoteEvents = [...voterActivatedEvents, ...voterRevokedEvents];

    const groups: Set<string> = voterActivatedEvents.reduce(
      (set, e) => set.add(e.returnValues.group),
      new Set<string>(),
    );
    const voters: Set<string> = voterActivatedEvents.reduce(
      (set, e) => set.add(e.returnValues.account),
      new Set<string>(),
    );

    const groupActivatedEvents = await this.getElectionEvents('ValidatorGroupVoteActivated', {
      group: [...groups],
    });
    const groupRevokedEvents = await this.getElectionEvents('ValidatorGroupActiveVoteRevoked', {
      group: [...groups],
    });

    const groupVoteEvents = [...groupActivatedEvents, ...groupRevokedEvents];

    const groupRewardEvents = await this.getElectionEvents('EpochRewardsDistributedToVoters', {
      group: [...groups],
    });

    const rewards: Rewards = [];

    groupRewardEvents.forEach((e) => {
      const group = e.returnValues.group;
      const groupTotal = this.groupTotal(groupVoteEvents, group);
      const groupReward = e.returnValues.value;

      if (new BN(groupTotal).ltn(0)) {
        throw new Error(`Vote total less than 0 (${groupTotal}) for ${group}`);
      }
      voters.forEach((voter) => {
        this.log(`Fetching voter rewards for ${voter}`);

        const voterTotal = this.voterTotalForGroup(voterVoteEvents, voter, group);
        if (voterTotal === '0') {
          return;
        }
        if (new BN(voterTotal).ltn(0)) {
          this.log(`Vote total less than 0 (${voterTotal}) for ${voter}:${group}`, true);
          return;
        }

        const rewardAmount = new BigNumber(groupReward)
          .multipliedBy(voterTotal)
          .dividedBy(groupTotal)
          .toFormat(0, 4, { groupSeparator: '' });

        if (new BN(rewardAmount).gtn(0)) {
          rewards.push({
            address: voter,
            alias: this.addresses.lookupAlias(voter),
            group: group,
            amount: this.toEth(rewardAmount, { numeric: true }),
            amount_wei: this.toNumeric(rewardAmount),
            currency: 'CELO',
            epoch: number,
            block: lastBlock,
            earned_at: lastBlockTime,
            earned_date: lastBlockDate,
            rewards_category: 'voter',
            rewards_type: 'credit',
          });
        } else if (new BN(rewardAmount).ltn(0)) {
          this.log(
            `Calculated reward amount less than 0 (${rewardAmount}) for ${voter}:${group}`,
            true,
          );
        }
      });
    });

    return rewards;
  }

  voterTotalForGroup(events: EventLog[], voter: string, group: string): string {
    return events
      .filter((e) => e.returnValues.group === group && e.returnValues.account === voter)
      .reduce((total, e) => this.updateTotal(total, e.returnValues.units, e.event), new BN('0'))
      .toString();
  }

  groupTotal(events: EventLog[], group: string): string {
    return events
      .filter((e) => e.returnValues.group === group)
      .reduce((total, e) => this.updateTotal(total, e.returnValues.units, e.event), new BN('0'))
      .toString();
  }

  updateTotal(total: BN, amount: string, type: string): BN {
    if (type === 'ValidatorGroupVoteActivated') {
      return total.add(new BN(amount));
    } else if (type === 'ValidatorGroupActiveVoteRevoked') {
      return total.sub(new BN(amount));
    } else {
      return total;
    }
  }

  async getElectionEvents(type: string, filters: Record<string, string[]>): Promise<EventLog[]> {
    const { lastBlock } = this.epoch;
    const election = await this.kit.contracts.getElection();
    return election.getPastEvents(type, {
      fromBlock: type === 'EpochRewardsDistributedToVoters' ? lastBlock : 0,
      toBlock: lastBlock,
      filter: filters,
    });
  }
}
