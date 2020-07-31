import BQ from '../common/bigquery';

export default async function createRevision(): Promise<number> {
  const bigquery = new BQ();
  return await bigquery.createRevision();
}
