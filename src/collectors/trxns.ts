import BaseCollector from './base';
import { Rewards } from '../common/types';
import { CeloExplorer } from '../common/celoExplorer';
import { concurrentMap } from '../common/concurrentMap';
import transactionTrace from '../common/transactionTrace';
import BN from 'bn.js';

export default class TrxnsCollector extends BaseCollector {
  async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, lastBlockTime, lastBlockDate, number } = this.epoch;
    const accounts = await this.kit.contracts.getAccounts();
    const election = await this.kit.contracts.getElection();
    const signers = await election.getValidatorSigners(firstBlock);

    const keys = await this.addresses.allKnownAddresses(accounts);

    const rewards: Rewards = [];

    await concurrentMap(5, keys, async (key) => {
      this.log(`Fetching trxns for ${key}`);
      const explorer = new CeloExplorer();

      const trxns = await explorer.getTransactions({
        address: key,
        startblock: firstBlock.toString(),
        endblock: lastBlock.toString(),
      });

      trxns.forEach((trxn) => {
        const isNegative = trxn.from.toLowerCase() === key.toLowerCase();
        const amount = isNegative
          ? new BN(trxn.value).add(new BN(trxn.gasUsed).mul(new BN(trxn.gasPrice)))
          : new BN(trxn.value);

        if (amount.gt(new BN(0))) {
          rewards.push({
            address: key,
            alias: this.addresses.lookupAlias(key),
            group: this.addresses.groupForAddress(key),
            amount: this.toEth(amount.toString(), { numeric: true, negative: isNegative }),
            amount_wei: this.toNumeric(amount.toString(), { negative: isNegative }),
            currency: 'CELO',
            epoch: number,
            block: Number(trxn.blockNumber),
            earned_at: this.timestampFromBlockTime(trxn.timeStamp),
            earned_date: this.dateFromBlockTime(trxn.timeStamp),
            rewards_category: 'trxn',
            rewards_type: isNegative ? 'debit' : 'credit',
          });
        }
      });

      const internalTrxns = await explorer.getInternalTransactions({
        address: key,
        startblock: firstBlock.toString(),
        endblock: lastBlock.toString(),
      });

      const trxnHashes: Set<string> = new Set();
      internalTrxns.forEach((trxn) => trxnHashes.add(trxn.transactionHash));

      const internalTraces = await concurrentMap(5, [...trxnHashes], async (trxnHash) =>
        transactionTrace(this.kit, trxnHash),
      );

      const relevantCalls = internalTraces.flat().filter((call) => {
        return (
          [call.from.toLowerCase(), call.to.toLowerCase()].includes(key.toLowerCase()) &&
          call.type === 'CALL'
        );
      });

      await concurrentMap(5, relevantCalls, async (trxn) => {
        const isNegative = trxn.from.toLowerCase() === key.toLowerCase();
        const amount = new BN(trxn.value.replace(/0x/, ''), 16);

        const transaction = await this.kit.web3.eth.getTransaction(trxn.transactionHash);
        const block = await this.kit.web3.eth.getBlock(transaction.blockNumber as number);

        if (amount.gt(new BN(0))) {
          rewards.push({
            address: key,
            alias: this.addresses.lookupAlias(key),
            group: this.addresses.groupForAddress(key),
            amount: this.toEth(amount.toString(), { numeric: true, negative: isNegative }),
            amount_wei: this.toNumeric(amount.toString(), { negative: isNegative }),
            currency: 'CELO',
            epoch: number,
            block: Number(block.number),
            earned_at: this.timestampFromBlockTime(block.timestamp),
            earned_date: this.dateFromBlockTime(block.timestamp),
            rewards_category: 'internalTrxn',
            rewards_type: isNegative ? 'debit' : 'credit',
          });
        }
      });

      // Convert all keys to lowercase, just to be sure
      const signersLowerCase = signers.map((signer) => signer.toLowerCase());

      // This checks if the key was elected, and thus able to receive trxn fees
      if (!signersLowerCase.includes(key.toLowerCase())) {
        return;
      }

      // Risk - I've seen trie node errors in baklava - this might be due to the node i am hitting,
      // or could be due to the testnet itself and when contracts were deployed
      // Mitigation - Added balance retrieval from Celo Explorer as a fallback
      const startingBalance = await this.getBalance(
        key,
        firstBlock === 1 ? firstBlock : firstBlock - 1,
      );
      const endingBalance = await this.getBalance(key, lastBlock);
      const amountTransacted = rewards
        .filter((reward) => reward.address === key)
        .reduce((amount, reward) => amount.add(new BN(reward.amount_wei)), new BN(0));

      // Risk - this is an implicit calculation of fees, which may be inaccurate if my other trxn accounting is not accurate
      // Mitigation - Reconciliation should highlight hopefully (and we log), so we can try to come up with a better way
      const fees = new BN(endingBalance).sub(new BN(startingBalance)).add(amountTransacted);

      if (fees.eq(new BN(0))) {
        return;
      }

      if (fees.lt(new BN(0))) {
        this.log({
          message: 'Fees apparently less than 0, may require manual intervention',
          address: key,
          signer: key,
          epoch: number,
          startingBalance: startingBalance,
          endingBalance: endingBalance,
          fees: fees.toString(),
          trxns: amountTransacted.toString(),
          investigate: 'true',
        });
        return;
      }

      rewards.push({
        address: key,
        alias: this.addresses.lookupAlias(key),
        group: this.addresses.groupForAddress(key),
        amount: this.toEth(fees.toString(), { numeric: true }),
        amount_wei: this.toNumeric(fees.toString()),
        currency: 'CELO',
        epoch: number,
        block: lastBlock,
        earned_at: lastBlockTime,
        earned_date: lastBlockDate,
        rewards_category: 'trxnFees',
        rewards_type: 'credit',
      });
    });

    return rewards;
  }

  async getBalance(address: string, blockNumber: number): Promise<string> {
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

      // As a fallback, use the balances from CeloExplorer
      const explorer = new CeloExplorer();
      return await explorer.getBalance({ address: address, block: blockNumber.toString() });
    }
  }
}
