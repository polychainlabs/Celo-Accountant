import {
  RPC_ENDPOINT_URL,
  NETWORK,
  NODE_ENV,
  DATASET_ID,
  TRANSACTIONS_TABLE_ID,
  REVISIONS_TABLE_ID,
  FUNCTION_URL,
} from '../constants';
import { StringIndexedObject } from '../common/types';

export default function configuration(): Promise<StringIndexedObject> {
  return new Promise((resolve) =>
    resolve({
      RPC_ENDPOINT_URL,
      NETWORK,
      NODE_ENV,
      DATASET_ID,
      TRANSACTIONS_TABLE_ID,
      REVISIONS_TABLE_ID,
      FUNCTION_URL,
    }),
  );
}
