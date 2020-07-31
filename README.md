# Celo Accountant

An application track balance changes on the Celo Blockchain and store results in BigQuery.

The goal is to observe any and all balance changes across monitored accounts, and store them
as a series of credits and debits, ideal for accounting purposes. At Polychain, this software
helps our Finance team keep track of balances and perform end of month accounting operations.

## Requirements

- Access to a Celo Node with Archive mode enabled.
- A GCP Project where you'd like to store the data and deploy the functions

## Setup

Update the `GCP_PROJECT` variable in `Makefile`, then run:
```
make new-project-setup
```

This:
- Enables several GCP API's
- Creates the BigQuery Tables

## Running locally

Update the `.env.development` file appropriately.
Add all addresses you want to monitor to `addresses.mainnet.yaml` and `addresses.baklava.yaml`.

Then:
```
make development
```

This will start a function-framework server running on port 8080 with hot reloading.

Next, create a new revision:

```
curl http://localhost:8080/create-revision
```

You should now be able to begin testing locally, with data stored in the `testing` database in BigQuery.

## Deploying

Make sure the `.env-*` file the network you are deploying has been updated, then:

```
make deploy NETWORK=<baklava|mainnet>
```

Confirm that everything is as expected with:

```
make get-configuration NETWORK=<baklava|mainnet>
```

Create your initial databse revision:

```
make create-revision NETWORK=<baklava|mainnet>
```

Confirm you are using the new revision:

```
make current-status NETWORK=<baklava|mainnet>
```

Now you should be able to backfill any missing epochs, or start processing current epochs.

## BigQuery

There a number of SQL queries I've found useful in the `queries/` folder.

## Make Commands

Many of the below commands come in a `-baklava`, `-mainnet`, or `-development` flavor. Any command that ends with one of these suffixes automatically sets the `NETWORK` flag to its suffix, i.e. `baklava`, `mainnet`, or `development`. This has been noted in the "flavors" column in the table below.

| Command             | Description                                                                                                               | Required Flags                      | Flavors                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------- |
| `development`       | Runs the development server                                                                                               | N/A                                 | N/A                    |
| `install`           | Installs all project dependencies                                                                                         | N/A                                 | N/A                    |
| `test`              | Runs the test suite                                                                                                       | N/A                                 | N/A                    |
| `build`             | Builds the application for deployment                                                                                     | N/A                                 | N/A                    |
| `clean`             | Removes the existing build artifacts                                                                                      | N/A                                 | N/A                    |
| `deploy`            | Builds and deploys the application                                                                                        | `NETWORK`                           | `-baklava`, `-mainnet` |
| `get-configuration` | Displays the current configuration settings for the deployed application                                                  | `NETWORK`                           | `-baklava`, `-mainnet` |
| `current-status`    | Displays the current status, i.e. current revisions and epochs processed                                                  | `NETWORK`                           | `-baklava`, `-mainnet` |
| `create-revision`   | Creates a new accounting revision in the database. Typically done if the logic changes substantially between deployments. | `NETWORK`                           | `-baklava`, `-mainnet` |
| `backfill`          | Initiates a backfill job                                                                                                  | `NETWORK`, `FROM_EPOCH`, `TO_EPOCH` | `-baklava`, `-mainnet` |
| `reconcile`         | Initiates a reconciliation job. `EPOCH` is an optional parameter, defaults to the latest epoch.                           | `NETWORK`                           | `-baklava`, `-mainnet` |
| `new-project-setup` | Configures and sets up a new GCP Project. Takes ~10min                                                                    | N/A                                 | N/A                    |

## Configuration

| env                   | description                                                           | default                 |
| --------------------- | --------------------------------------------------------------------- | ----------------------- |
| RPC_ENDPOINT_URL      | The URL of the Celo node                                              | Baklava Forno node      |
| NETWORK               | The network this is running on `baklava` or `mainnet`                 | `baklava`               |
| NODE_ENV              | The node environment this is running in `development` or `production` | `development`           |
| DATASET_ID            | The name of the BigQuery dataset to load data into                    | `testing`               |
| REVISIONS_TABLE_ID    | The name of the revisions table in BigQuery                           | `revisions`             |
| TRANSACTIONS_TABLE_ID | The name of the transactions table in BigQuery                        | `transactions`          |
| FUNCTION_URL          | URL of the function                                                   | `http://localhost:8080` |

## Endpoints

Endpoints all support GET or POST.

To `curl` a production endpoint, you can use:

```
@curl -H "Authorization: bearer $(shell gcloud auth print-identity-token)" \
  https://<FUNCTION_URL>/<endpoint>
```

### `/configuration`

Returns the current configuration, as represented by the environment variables. Useful for ensuring that your function is running with the correct set of parameters.

Response:

```
{
  RPC_ENDPOINT_URL: <string>,
  IAP_ENABLED: <boolean>,
  NETWORK: <string>,
  NODE_ENV: <string>,
  DATASET_ID: <string>,
  TRANSACTIONS_TABLE_ID: <string>,
  REVISIONS_TABLE_ID: <string>,
  PROJECT_ID: <string>,
  FUNCTION_URL: <string>,
}
```

Example curl (development):

```
curl \
  --header "Content-Type: application/json" \
  http://localhost:8280/configuration
```

Equivalent make command: `make get-configuration NETWORK=<network>`.

### `/current-status`

Returns the current progress of the accountant, namely the current revision, the last epoch procesed, and a list of the last 100 epochs processed.

Response:

```
{
  currentRevision: <number>,
  latestEpoch: <number>,
  allEpochs: [<number>],
  error?: <boolean>,
}
```

Example curl (development):

```
curl \
  --header "Content-Type: application/json" \
  http://localhost:8280/current-status
```

Equivalent make command: `make current-status NETWORK=<network>`.

### `/initiate-backfill`

| arg       | description                                                               |
| --------- | ------------------------------------------------------------------------- |
| fromEpoch | The epoch to start backfilling from                                       |
| toEpoch   | The epoch to end backfilling at                                           |
| addresses | The set of addresses to backfill. Same format as `addresses.mainnet.yaml` |

Starts a backfill operation, processing the epochs specified.

Under the hood, this first calls `backfillEpoch` with `epoch: <fromEpoch>`.
Once that completes, it calls `initiateBackfill` with `fromEpoch: <fromEpoch> + 1`.

It repeats this until `fromEpoch` == `toEpoch`.

Response:

```
✅|❌
```

Example curl (development):

```
curl \
  --header "Content-Type: application/json" \
  http://localhost:8080/initiate-backfill?fromEpoch=<from>&toEpoch=<to>
```

Equivalent make command: `make backfill NETWORK=<network> FROM_EPOCH=1 TO_EPOCH=10`.

### `/backfill-epoch`

| arg       | description                                                               |
| --------- | ------------------------------------------------------------------------- |
| epoch     | The epoch to backfill                                                     |
| addresses | The set of addresses to backfill. Same format as `addresses.mainnet.yaml` |

Backfills a specific epoch.

Response:

```
✅|❌
```

Example curl (development):

```
curl \
  --header "Content-Type: application/json" \
  http://localhost:8080/backfill-epoch
```

Equivalent make command: `make process-epoch NETWORK=<network> EPOCH=<epoch>`.

### createRevision

Creates a new revision. Typically done if the accounting logic changes substantially between deploys.

Response:

```
<revision_id>
```

Example curl (development):

```
curl \
  --header "Content-Type: application/json" \
  http://localhost:8080/create-revision
```

Equivalent make command: `make create-revision NETWORK=<network>`.

### `/process-latest-epoch`

Checks if a new Epoch has completed, and if so, tries to process it.

Response:

```
✅|❌
```

Example curl (development):

```
curl \
  --header "Content-Type: application/json" \
  http://localhost:8080/process-latest-epoch
```

There is no equivalent make command, as this endpoint is typically called by the Cloud Scheduler Job.

### `/reconcile`

| arg   | description                                                              |
| ----- | ------------------------------------------------------------------------ |
| epoch | The epoch to run reconciliation for (optional, defaults to latest epoch) |

Runs the reconciliation checks to see if calculated balances match on chain balances. Returns address with potential issues.

Response:

```
[
  {
    address: string,
    alias: string,
    onChainGold: string,
    calculatedGold: string,
    onChainLiquidGold: string,
    onChainLockedGold: string,
    goldDifference: string,
    onChainUSD: string,
    calculatedUSD: string,
    usdDifference: string,
  },
  ...
]
```

Example curl (development):

```
curl \
  --header "Content-Type: application/json" \
  http://localhost:8080/reconcile
```

Equivalent make command: `make reconcile NETWORK=<network> EPOCH=<?epoch>`
