// Function to do an action, and return success or failure
// Function to wrap another function in a try/catch block
import { GoogleAuth } from 'google-auth-library';
import { Response, Request } from 'express';
import { catchAndLogAsync, catchAndReturnDefaultAsync } from './common/decorators';
import { UserInput, StringIndexedObject } from './common/types';
import { PROJECT_ID, FUNCTION_URL } from './constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function successOrFailure<T extends Array<any>, U>(
  fn: (input: UserInput) => Promise<U>,
): (req: Request, res: Response) => Promise<void> {
  return async function (req, res): Promise<void> {
    try {
      await catchAndLogAsync(fn)(req.userInput);
      res.end('✅');
    } catch {
      res.end('❌');
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function returnActionValue<T extends Array<any>, U>(
  fn: (input?: UserInput) => Promise<U>,
  defaultValue: U,
): (req: Request, res: Response) => Promise<void> {
  return async function (req, res): Promise<void> {
    const returnValue = await catchAndReturnDefaultAsync(fn, defaultValue)(req.userInput);
    res.end(JSON.stringify(returnValue, null, 2));
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callSelf(url: string, input: UserInput): Promise<any> {
  const auth = new GoogleAuth({ projectId: PROJECT_ID });
  const client = await auth.getIdTokenClient(FUNCTION_URL);
  return client.request({
    method: 'POST',
    baseUrl: FUNCTION_URL,
    url: url,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

function merge(a: object, b: object): object {
  return { ...a, ...b };
}

export function createUserInput(
  queryParams: Request['query'],
  body: StringIndexedObject,
): UserInput {
  const merged: StringIndexedObject = merge(queryParams || {}, body);

  if (merged['epoch']) {
    merged['epoch'] = Number(merged['epoch']);
  }
  if (merged['fromEpoch']) {
    merged['fromEpoch'] = Number(merged['fromEpoch']);
  }
  if (merged['toEpoch']) {
    merged['toEpoch'] = Number(merged['toEpoch']);
  }

  return merged;
}
