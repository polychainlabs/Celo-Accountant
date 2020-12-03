variable "network" {
  type = string
}

resource "google_bigquery_dataset" "dataset" {
  dataset_id = var.network
}

resource "google_bigquery_table" "revisions" {
  dataset_id = google_bigquery_dataset.dataset.dataset_id
  table_id   = "revisions"

  schema = <<EOF
[
  {
    "name": "revision",
    "type": "INTEGER",
    "mode": "REQUIRED",
    "description": "The Revision ID"
  },
  {
    "name": "created_at",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "When the revision was created"
  }
]
EOF

}

resource "google_bigquery_table" "transactions" {
  provider = google-beta

  dataset_id = google_bigquery_dataset.dataset.dataset_id
  table_id   = "transactions"

  clustering = [
    "epoch"
  ]

  range_partitioning {
    field = "revision"
    range {
      start     = 1
      end       = 1000
      interval  = 1
    }
  }

  schema = <<EOF
[
  {
    "name": "id",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "Unique identifier for the record"
  },
  {
    "name": "address",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The address that earned the rewards on chain"
  },
  {
    "name": "alias",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The human name of the address that earned the rewards on chain"
  },
  {
    "name": "group",
    "type": "STRING",
    "mode": "NULLABLE",
    "description": "The group that was associated with the earned rewards"
  },
  {
    "name": "amount_wei",
    "type": "NUMERIC",
    "mode": "REQUIRED",
    "description": "The trxn amount in wei"
  },
  {
    "name": "amount",
    "type": "NUMERIC",
    "mode": "REQUIRED",
    "description": "The trxn amount in CELO"
  },
  {
    "name": "currency",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The currency the reward was earned in"
  },
  {
    "name": "epoch",
    "type": "INTEGER",
    "mode": "REQUIRED",
    "description": "The epoch the reward was earned in"
  },
  {
    "name": "block",
    "type": "INTEGER",
    "mode": "REQUIRED",
    "description": "The last block of the epoch the reward was earned in"
  },
  {
    "name": "earned_at",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "The timestamp of the last block of the epoch the reward was earned in"
  },
  {
    "name": "earned_date",
    "type": "DATE",
    "mode": "REQUIRED",
    "description": "The date of the last block of the epoch the reward was earned in"
  },
  {
    "name": "category",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The category of rewards this record denotes"
  },
  {
    "name": "type",
    "type": "STRING",
    "mode": "REQUIRED",
    "description": "The type of rewards this record denotes, i.e. credit or debit"
  },
  {
    "name": "revision",
    "type": "INTEGER",
    "mode": "REQUIRED",
    "description": "The revision this record is associated with"
  },
  {
    "name": "inserted_at",
    "type": "TIMESTAMP",
    "mode": "REQUIRED",
    "description": "The timestamp of when the record was inserted"
  }
]
EOF
}
