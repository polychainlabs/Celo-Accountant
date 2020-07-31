import { RPC_ENDPOINT_URL } from '../constants';
import { ContractKit, newKit } from '@celo/contractkit';

/** ContractKit Provider always returns a fresh ContractKit for you to use. */
export class KitProvider {
  rpcUrl: string;

  constructor() {
    this.rpcUrl = RPC_ENDPOINT_URL;
  }
  /** Get a new kit */
  getKit(): ContractKit {
    return newKit(this.rpcUrl);
  }
}
