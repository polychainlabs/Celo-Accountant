import Accountant from '../accountant';
import { Reconciliations, UserInput } from '../common/types';

export default async function reconcile(input: UserInput = {}): Promise<Reconciliations> {
  const accountant = await Accountant.conjure();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epoch = ['', undefined, null].includes(input.epoch as any)
    ? undefined
    : Number(input.epoch);
  return await accountant.reconcile(epoch);
}
