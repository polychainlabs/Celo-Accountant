import Accountant from '../accountant';

export default async function processLatestEpoch(): Promise<void> {
  const accountant = await Accountant.conjure();
  await accountant.processLatestEpoch();
}
