import { CurrentStatus } from '../common/types';
import BQ from '../common/bigquery';

export default async function currentStatus(): Promise<CurrentStatus> {
  const bigquery = new BQ();

  const currentRevision = await bigquery.currentRevision();
  const latestEpoch = await bigquery.lastEpochProcessed(currentRevision);
  const allEpochs = await bigquery.allEpochsProcessed(currentRevision);

  return {
    currentRevision,
    latestEpoch,
    allEpochs,
  };
}
