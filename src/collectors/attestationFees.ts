import BaseCollector from './base';
import { Rewards } from '../common/types';
import { concurrentMap } from '../common/concurrentMap';

export default class AttestationFeesCollector extends BaseCollector {
  protected tokenSymbols: { [tokenAddress: string]: string } = {};

  protected async collect(): Promise<Rewards> {
    const { firstBlock, lastBlock, number } = this.epoch;
    const accounts = await this.kit.contracts.getAccounts();
    const attestations = await this.kit.contracts.getAttestations();

    const attestationKeys = await this.addresses.allSignerKeysOfType('Attestation', accounts);
    // @ts-ignore: access protected property
    const events = await attestations.getPastEvents('Withdrawal', {
      fromBlock: firstBlock,
      toBlock: lastBlock,
      filter: {
        account: attestationKeys,
      },
    });

    const rewards: Rewards = [];
    await concurrentMap(10, events, async (event) => {
      const { account, token, amount } = event.returnValues;
      this.log(`Fetching attestation rewards for ${account}`);
      const block = await this.kit.web3.eth.getBlock(event.blockNumber);
      const tokenSymbol = await this.getSymbolForToken(token);

      rewards.push({
        address: account,
        alias: this.addresses.lookupAlias(account),
        group: this.addresses.groupForAddress(account, true),
        amount: this.toEth(amount, { numeric: true }),
        amount_wei: this.toNumeric(amount),
        currency: tokenSymbol,
        epoch: number,
        block: lastBlock,
        earned_at: this.timestampFromBlockTime(block.timestamp),
        earned_date: this.dateFromBlockTime(block.timestamp),
        category: 'attestationFees',
        type: 'credit',
      });
    });

    return rewards;
  }

  // This relies on the fact that CELO and cUSD are both ERC20 compliant tokens
  // and thus their contracts expose a `symbol` method.
  //
  // So we just call the symbol method on the contract represented by the token address
  protected async getSymbolForToken(tokenAddress: string): Promise<string> {
    if (tokenAddress in this.tokenSymbols) {
      return this.tokenSymbols[tokenAddress];
    }

    const abi = [
      {
        constant: true,
        inputs: [],
        name: 'symbol',
        outputs: [
          {
            name: '',
            type: 'string',
          },
        ],
        payable: false,
        type: 'function',
      },
    ];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tokenContract = new this.kit.web3.eth.Contract(abi as any, tokenAddress);
      const tokenSymbol = await tokenContract.methods.symbol().call();
      this.tokenSymbols[tokenAddress] = tokenSymbol;

      return tokenSymbol;
    } catch (error) {
      console.error(`Error fetching symbol for ${tokenAddress}`, error);
      this.log({
        message: `Error fetching symbol for ${tokenAddress}`,
        token: tokenAddress,
        investigate: true,
        error: error.message,
      });
      return tokenAddress;
    }
  }
}
