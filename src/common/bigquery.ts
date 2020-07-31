import { BigQuery, Table } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';
import log from './log';
import { DATASET_ID, REVISIONS_TABLE_ID, TRANSACTIONS_TABLE_ID, PROJECT_ID } from '../constants';
import { AddressBalances, LatestRows, Rewards, NumRecordsRows } from './types';

export function bigQueryClient(): BigQuery {
  return new BigQuery({ projectId: PROJECT_ID });
}

export default class BQ {
  protected client: BigQuery;
  protected rewards: Table;
  protected revisions: Table;

  constructor(client?: BigQuery) {
    if (typeof client === 'undefined') {
      client = bigQueryClient();
    }
    this.client = client;
    this.rewards = this.tableReference(TRANSACTIONS_TABLE_ID);
    this.revisions = this.tableReference(REVISIONS_TABLE_ID);
  }

  async currentRevision(): Promise<number> {
    const result = await this.revisions.query({
      query: `
        SELECT MAX(revision) as latest
        FROM ${DATASET_ID}.${REVISIONS_TABLE_ID}`,
    });
    const rows = result[0];

    if (rows.length === 0) {
      return 0;
    }

    const latestRevision = (rows as LatestRows)[0].latest;
    return latestRevision || 0;
  }

  async createRevision(): Promise<number> {
    const currentRevision = await this.currentRevision();
    const newRevision = {
      revision: currentRevision + 1,
      created_at: new Date().toISOString(),
    };
    await this.revisions.insert([newRevision]);
    log(`Created new revision with ID ${newRevision.revision}`);

    return newRevision.revision;
  }

  async lastEpochProcessed(revision: number): Promise<number> {
    const result = await this.rewards.query({
      query: `
        SELECT MAX(epoch) as latest
        FROM ${DATASET_ID}.${TRANSACTIONS_TABLE_ID}
        WHERE revision = @revision`,
      params: { revision },
    });
    const rows = result[0];

    if (rows.length === 0) {
      return 0;
    }

    const lastEpoch = (rows as LatestRows)[0].latest;
    return lastEpoch || 0;
  }

  async allEpochsProcessed(revision: number): Promise<Array<number>> {
    const result = await this.rewards.query({
      query: `
        SELECT DISTINCT epoch
        FROM ${DATASET_ID}.${TRANSACTIONS_TABLE_ID}
        WHERE revision = @revision
        ORDER BY epoch DESC
        LIMIT 100`,
      params: { revision },
    });
    const rows = result[0];

    if (rows.length === 0) {
      return [];
    }

    return rows.map((row) => row.epoch);
  }

  async epochProcessed(epoch: number, revision: number): Promise<boolean> {
    const result = await this.rewards.query({
      query: `
        SELECT COUNT(*) as numRecords
        FROM ${DATASET_ID}.${TRANSACTIONS_TABLE_ID}
        WHERE revision = @revision
        AND epoch = @epoch`,
      params: { revision, epoch },
    });
    const rows = result[0];

    if (rows.length === 0) {
      return false;
    }

    const numRecords = (rows as NumRecordsRows)[0].numRecords;
    return (numRecords || 0) > 0;
  }

  async addressProcessed(address: string, epoch: number, revision: number): Promise<boolean> {
    const result = await this.rewards.query({
      query: `
        SELECT COUNT(*) as numRecords
        FROM ${DATASET_ID}.${TRANSACTIONS_TABLE_ID}
        WHERE revision = @revision
        AND epoch = @epoch
        AND address = @address`,
      params: { revision, epoch, address },
    });
    const rows = result[0];

    if (rows.length === 0) {
      return false;
    }

    const numRecords = (rows as NumRecordsRows)[0].numRecords;
    return (numRecords || 0) > 0;
  }

  async getCalculatedBalances(epoch: number, revision: number): Promise<AddressBalances> {
    const result = await this.rewards.query({
      query: `
        SELECT address, currency, SUM(amount_wei) as balance
        FROM ${DATASET_ID}.${TRANSACTIONS_TABLE_ID}
        WHERE revision = @revision
        AND epoch <= @epoch
        GROUP BY 1, 2
        ORDER BY 1, 2`,
      params: { revision, epoch },
    });
    const rows = result[0];

    if (rows.length === 0) {
      return {};
    }

    return rows.reduce((addresses, record) => {
      const { address, currency, balance } = record;
      addresses[address] = addresses[address] || { CELO: 0, cUSD: 0 };
      addresses[address][currency] = balance;
      return addresses;
    }, {});
  }

  async loadRewards(rewards: Rewards, revision: number): Promise<void> {
    const epoch = rewards[0].epoch;
    if (await this.epochProcessed(epoch, revision)) {
      log(`Already inserted rewards for Epoch ${epoch}, revision: ${revision}`);
      return;
    }

    const rows = rewards.map((reward) => {
      return {
        ...reward,
        revision,
        id: uuidv4(),
        inserted_at: BigQuery.datetime(new Date().toISOString()),
      };
    });

    await this.rewards.insert(rows);
    log(`Loaded ${rows.length} records into ${DATASET_ID}.${TRANSACTIONS_TABLE_ID}`);
  }

  async loadRewardsForAddress(rewards: Rewards, revision: number): Promise<void> {
    const { epoch, address } = rewards[0];
    if (await this.addressProcessed(address, epoch, revision)) {
      log(`Already inserted rewards for ${address}, epoch: ${epoch}, revision: ${revision}`);
      return;
    }

    const rows = rewards.map((reward) => {
      return {
        ...reward,
        revision,
        id: uuidv4(),
        inserted_at: BigQuery.datetime(new Date().toISOString()),
      };
    });

    await this.rewards.insert(rows);
    log(`Loaded ${rows.length} records into ${DATASET_ID}.${TRANSACTIONS_TABLE_ID}`);
  }

  protected tableReference(tableName: string): Table {
    return this.client.dataset(DATASET_ID).table(tableName);
  }
}
