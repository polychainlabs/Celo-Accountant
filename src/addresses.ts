import yaml from 'js-yaml';
import fs from 'fs';
import { NETWORK } from './constants';
import log from './common/log';
import flatten from 'lodash.flatten';
import { AccountsWrapper } from '@celo/contractkit/lib/wrappers/Accounts.d';
import { AddressSet, Addresses } from './common/types';

const defaultAddresses: AddressSet = yaml.safeLoad(
  fs.readFileSync(`./addresses.${NETWORK}.yaml`, { encoding: 'utf8' }),
);

export class MonitoredAddresses implements Addresses {
  addresses: AddressSet;
  groupMapping: { [key: string]: string | undefined } = {};

  constructor(addresses?: AddressSet | undefined) {
    if (addresses) {
      this.addresses = addresses;
    } else {
      this.addresses = defaultAddresses;
    }
  }

  allVoters(): Array<string> {
    const addresses = new Set([
      ...this.addresses.delegators,
      ...this.allGroupOwners(),
      ...this.allValidators(),
    ]);

    return [...addresses];
  }

  allGroupOwners(): Array<string> {
    return this.addresses.groups.map((g) => g.owner);
  }

  allValidators(): Array<string> {
    return flatten(this.addresses.groups.map((g) => g.validators));
  }

  allAliasedAddresses(): Array<string> {
    return Object.keys(this.addresses.aliases);
  }

  lookupAlias(address: string): string {
    return this.addresses.aliases[address] || '';
  }

  addAlias(address: string, alias: string): void {
    this.addresses.aliases[address] = alias;
  }

  groupForValidator(validator: string, warn = false): string | undefined {
    const group = this.addresses.groups.find((group) => group.validators.includes(validator));
    if (typeof group === 'undefined') {
      if (warn) {
        log({
          message: `Cannot find group for validator ${validator}`,
          address: validator,
          investigate: true,
        });
      }
      return;
    }

    return group.owner;
  }

  groupForAddress(address: string, warn = false): string | undefined {
    if (this.allGroupOwners().includes(address)) {
      return address;
    } else if (address in this.groupMapping) {
      return this.groupMapping[address];
    }
    return this.groupForValidator(address, warn);
  }

  isSigner(address: string): boolean {
    return this.lookupAlias(address).match(/Signer/) !== null;
  }

  async allSignerKeysOfType(
    keyType: 'Validator' | 'Attestation',
    accounts: AccountsWrapper,
  ): Promise<Array<string>> {
    // Need to check if we have any validators, otherwise we'll grab _all_ signing keys for _all_ validators
    if (this.allValidators().length === 0) {
      return [];
    }

    // @ts-ignore: access protected property
    const events = await accounts.getPastEvents(`${keyType}SignerAuthorized`, {
      fromBlock: 0,
      filter: {
        account: this.allValidators(),
      },
    });

    return events.reduce((keys: Array<string>, event) => {
      const { signer, account } = event.returnValues;
      if (!this.lookupAlias(account)) {
        log({
          message: 'Unknown signer/account combo',
          signer,
          address: account,
          investigate: 'true',
        });
      }

      this.addAlias(signer, `${this.lookupAlias(account)} - ${keyType}Signer`);
      this.groupMapping[signer as string] = this.groupForValidator(account, true);

      keys.push(signer);
      return keys;
    }, []);
  }

  async allKnownAddresses(accounts: AccountsWrapper): Promise<Array<string>> {
    const validatorSignerKeys = await this.allSignerKeysOfType('Validator', accounts);
    const addresses = new Set([
      ...validatorSignerKeys,
      ...this.allVoters(),
      ...this.allAliasedAddresses(),
    ]);
    return [...addresses];
  }
}
