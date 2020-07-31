import { StringIndexedObject } from './types';

const IDENTIFIER = 'celo-accountant';

/** log a message */
function log(loggable: unknown, inject: StringIndexedObject = {}): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logObject: any;
  if (typeof loggable === 'object') {
    logObject = { ...loggable, ...inject, identifier: IDENTIFIER };
  } else {
    logObject = {
      message: loggable,
      identifier: IDENTIFIER,
      ...inject,
    };
  }
  console.log(JSON.stringify(logObject));
}

export default log;
export { IDENTIFIER };
