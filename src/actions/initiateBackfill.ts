import { UserInput } from '../common/types';
import { sleep } from '../common/utils';
import log from '../common/log';
import { callSelf } from '../routing';

export default async function initiateBackfill(input: UserInput): Promise<void> {
  const { fromEpoch, toEpoch, addresses } = input;

  if (typeof fromEpoch === 'undefined') {
    throw new Error('Missing required parameter fromEpoch');
  }

  if (typeof toEpoch === 'undefined') {
    throw new Error('Missing required parameter toEpoch');
  }

  const backfillInstructions = { epoch: fromEpoch, addresses };
  const response = await callSelf('/backfill-epoch', backfillInstructions);

  // Sleep 10 seconds to avoid DOS'ing the nodes
  await sleep(10000);

  // If the backfill request failed, retry
  if (response.status !== 200) {
    await sleep(10000);
    return callSelf('/initiate-backfill', input);
  }

  // If we're done, return
  if (fromEpoch === toEpoch) {
    log('Backfill completed');
    return;
  }

  // Else, initiate a backfill request for the next epoch
  const initiateBackfillInstructions = {
    fromEpoch: fromEpoch + 1,
    toEpoch: toEpoch,
    addresses,
  };
  callSelf('/initiate-backfill', initiateBackfillInstructions);
}
