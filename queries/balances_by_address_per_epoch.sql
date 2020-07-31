WITH most_recent_revision AS (
  SELECT MAX(revision) AS revision
  FROM mainnet.revisions
),
trxns AS (
  SELECT transactions.*
  FROM mainnet.transactions
  INNER JOIN most_recent_revision
  ON transactions.revision = most_recent_revision.revision
),
all_epochs AS (
  SELECT addresses.*, dates.earned_date
  FROM (
    SELECT DISTINCT address, alias, MIN(earned_date) AS first_trxn_date
    FROM trxns
    GROUP BY 1, 2
  ) AS addresses
  CROSS JOIN (
    SELECT DISTINCT earned_date
    FROM trxns
    GROUP BY 1
  ) AS dates
  WHERE dates.earned_date >= addresses.first_trxn_date
),
per_epoch_totals AS (
  SELECT
    all_epochs.earned_date
  , all_epochs.address
  , all_epochs.alias
  , SUM(CASE WHEN currency = 'CELO' THEN amount_wei ELSE 0 END) AS delta_celo
  , SUM(CASE WHEN currency = 'cUSD' THEN amount_wei ELSE 0 END) AS delta_cusd
  FROM all_epochs
  LEFT JOIN trxns
  ON all_epochs.earned_date = trxns.earned_date
  AND all_epochs.address = trxns.address
  GROUP BY 1, 2, 3
),
per_address AS (
  SELECT
    earned_date
  , address
  , alias
  , SUM(delta_celo) OVER (
      PARTITION BY address
      ORDER BY earned_date ASC
    ) / POWER(10, 18) as balance_celo
  , SUM(delta_cusd) OVER (
      PARTITION BY address
      ORDER BY earned_date ASC
    ) / POWER(10, 18) as balance_cusd
  FROM per_epoch_totals
  ORDER BY 2, 1
)
SELECT *
FROM per_address
WHERE earned_date > DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
