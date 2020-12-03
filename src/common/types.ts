import { AccountsWrapper } from '@celo/contractkit/lib/wrappers/Accounts.d';
import { ContractKit } from '@celo/contractkit';
import BQ from './bigquery';

export interface YamlGroup {
  name: string;
  owner: string;
  validators: Array<string>;
}

export interface AddressSet {
  delegators: Array<string>;
  groups: Array<YamlGroup>;
  slashers: Array<string>;
  aliases: { [index: string]: string };
}

export interface Addresses {
  addresses: AddressSet;
  groupMapping: { [key: string]: string | undefined };
  allVoters(): Array<string>;
  allGroupOwners(): Array<string>;
  allValidators(): Array<string>;
  allAliasedAddresses(): Array<string>;
  allKnownAddresses(accounts: AccountsWrapper): Promise<Array<string>>;

  lookupAlias(address: string): string;
  addAlias(address: string, alias: string): void;

  groupForValidator(validator: string, warn?: boolean): string | undefined;
  groupForAddress(address: string, warn?: boolean): string | undefined;
  isSigner(address: string): boolean;
  allSignerKeysOfType(
    keyType: 'Validator' | 'Attestation',
    accounts: AccountsWrapper,
  ): Promise<Array<string>>;
}

export type StringIndexedObject = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface ReconcilerArgs {
  kit: ContractKit;
  database: BQ;
  epoch: number;
  blockNumber: number;
  revision: number;
  addresses: Addresses;
}

export interface Reconciliation extends StringIndexedObject {
  address: string;
  alias: string;
  onChainGold: string;
  calculatedGold: string;
  onChainLiquidGold: string;
  onChainLockedGold: string;
  goldDifference: string;
  onChainUSD: string;
  calculatedUSD: string;
  usdDifference: string;
  mismatch: boolean;
  epoch: number;
}

export type Reconciliations = Array<Reconciliation>;

export interface RewardRow extends Reward {
  revision: number;
  id: string;
  inserted_at: string;
}

export type RewardRows = Array<RewardRow>;

export interface RevisionRow {
  revision: number;
  created_at: string;
}

export type RevisionRows = Array<RevisionRow>;

export interface LatestRow {
  latest: number;
}

export type LatestRows = Array<LatestRow>;

export interface NumRecordsRow {
  numRecords: number;
}

export type NumRecordsRows = Array<NumRecordsRow>;

export type AddressBalances = {
  [address: string]: {
    CELO: number;
    cUSD: number;
  };
};

export interface CollectorArgs {
  kit: ContractKit;
  epoch: Epoch;
  addresses: Addresses;
}

export interface Epoch {
  number: number;
  firstBlock: number;
  lastBlock: number;
  lastBlockTime: string;
  lastBlockDate: string;
}

export interface Reward {
  address: string;
  alias: string;
  group?: string;
  amount: string;
  amount_wei: string;
  currency: string;
  epoch: number;
  block: number;
  earned_at: string;
  earned_date: string;
  category: string;
  type: string;
}

export type Rewards = Array<Reward>;

export interface CurrentStatus {
  currentRevision: number;
  latestEpoch: number;
  allEpochs: Array<number>;
  error?: boolean;
}

export interface UserInput {
  epoch?: number;
  fromEpoch?: number;
  toEpoch?: number;
  addresses?: AddressSet;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Call {
  type: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  error: string;
  time: string;
  calls?: Call[];
}

export interface AugmentedCall extends Call {
  transactionHash: string;
}

export interface Trxn {
  blockNumber: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  from: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  hash: string;
  timeStamp: string;
  to: string;
  value: string;
  type: string;
}

export interface InternalTrxn {
  blockNumber: string;
  contractAddress: string;
  from: string;
  gas: string;
  index: string;
  input: string;
  gasUsed: string;
  timeStamp: string;
  transactionHash: string;
  to: string;
  value: string;
  type: string;
}
