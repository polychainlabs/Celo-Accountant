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
SELECT
  address
, alias
, SUM(CASE WHEN currency = 'CELO' THEN amount_wei ELSE 0 END) / POWER(10,18) AS balance_celo
, SUM(CASE WHEN currency = 'cUSD' THEN amount_wei ELSE 0 END) / POWER(10,18) AS balance_cusd
FROM trxns
GROUP BY 1, 2
ORDER BY 2 ASC
;
