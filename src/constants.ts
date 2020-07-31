const DEFAULTS: { [key: string]: string } = {
  // The Node URL
  RPC_ENDPOINT_URL: 'https://baklava-forno.celo-testnet.org',
  // Which network to run on
  NETWORK: 'baklava',
  // The type of environment to run in
  NODE_ENV: 'development',
  // The dataset to load data into
  DATASET_ID: 'testing',
  // The table to load rewards data into
  TRANSACTIONS_TABLE_ID: 'rewards',
  // The table to that stores revision data
  REVISIONS_TABLE_ID: 'revisions',
  // Function URL
  FUNCTION_URL: 'http://localhost:8080',
};

function loadValue(key: string): string {
  const fromProcess = process.env[key];

  if (typeof fromProcess === 'undefined') {
    const fromDefault = DEFAULTS[key];
    if (typeof fromDefault === 'undefined') {
      throw new Error(`Could not load value for ${key}`);
    }

    return fromDefault;
  }

  return fromProcess;
}

export const RPC_ENDPOINT_URL = loadValue('RPC_ENDPOINT_URL');
export const NETWORK = loadValue('NETWORK');
export const NODE_ENV = loadValue('NODE_ENV');
export const DATASET_ID = loadValue('DATASET_ID');
export const TRANSACTIONS_TABLE_ID = loadValue('TRANSACTIONS_TABLE_ID');
export const REVISIONS_TABLE_ID = loadValue('REVISIONS_TABLE_ID');
export const FUNCTION_URL = loadValue('FUNCTION_URL');
export const PROJECT_ID = loadValue('GCP_PROJECT');
