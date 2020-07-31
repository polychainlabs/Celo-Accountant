import Accountant from '../accountant';
import { UserInput } from '../common/types';

export default async function backfillEpoch(input: UserInput): Promise<void> {
  const { epoch, addresses } = input;

  if (typeof epoch === 'undefined') {
    throw new Error('Missing required parameter `epoch`');
  }

  const accountant = await Accountant.conjure(addresses);
  await accountant.backfillAddresses(epoch);
}
