import got from 'got';
import { NETWORK } from '../constants';
import log from './log';
import BN from 'bn.js';
import { URLSearchParams } from 'url';
import { InternalTrxn, Trxn } from './types';

const MAINNET_URL = 'https://explorer.celo.org/api';
const BAKLAVA_URL = 'https://baklava-blockscout.celo-testnet.org/api';

interface GetTransactionArgs {
  address: string;
  startblock?: string;
  endblock?: string;
  filterby?: 'to' | 'from';
}

interface GetInternalTransactionArgs {
  address: string;
  startblock?: string;
  endblock?: string;
}

interface GetBalanceArgs {
  address: string;
  block?: string;
}

interface TrxnResponse {
  message: string;
  result: Array<Trxn>;
  status: string;
}

interface InternalTrxnResponse {
  message: string;
  result: Array<InternalTrxn>;
  status: string;
}

interface BalanceResponse {
  result: string;
}

export class CeloExplorer {
  protected baseURL: string;

  constructor() {
    switch (NETWORK) {
      case 'mainnet':
        this.baseURL = MAINNET_URL;
        break;
      case 'baklava':
        this.baseURL = BAKLAVA_URL;
        break;
      default:
        throw new Error(`Unknown network ${NETWORK}`);
    }
  }

  async getBalance(args: GetBalanceArgs): Promise<string> {
    const params = { ...args, module: 'account', action: 'eth_get_balance' };
    const searchParams = new URLSearchParams(Object.entries(params as { [key: string]: string }));
    try {
      const response: BalanceResponse = await got(this.baseURL, { searchParams }).json();
      return new BN(response.result).toString();
    } catch (error) {
      console.error(error);
      log({
        message: `Could not fetch balance for ${args.address}`,
        address: args.address,
        investigate: 'true',
        error: error.message,
        params: args,
      });
      return '0';
    }
  }

  async getTransactions(args: GetTransactionArgs): Promise<Array<Trxn>> {
    const params = { ...args, module: 'account', action: 'txlist' };
    const searchParams = new URLSearchParams(Object.entries(params as { [key: string]: string }));
    try {
      const response: TrxnResponse = await got(this.baseURL, { searchParams }).json();
      return response.result;
    } catch (error) {
      console.error(error);
      log({
        message: `Could not fetch transactions for ${args.address}`,
        address: args.address,
        investigate: 'true',
        error: error.message,
        params: args,
      });
      return [];
    }
  }

  async getInternalTransactions(args: GetInternalTransactionArgs): Promise<Array<InternalTrxn>> {
    const params = { ...args, module: 'account', action: 'txlistinternal' };
    const searchParams = new URLSearchParams(Object.entries(params as { [key: string]: string }));
    try {
      const response: InternalTrxnResponse = await got(this.baseURL, { searchParams }).json();
      return response.result;
    } catch (error) {
      console.error(error);
      log({
        message: `Could not fetch internal transactions for ${args.address}`,
        address: args.address,
        investigate: 'true',
        error: error.message,
        params: args,
      });
      return [];
    }
  }
}
