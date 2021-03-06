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
  epoch
, address
, alias
, SUM(CASE WHEN currency = 'CELO' THEN amount_wei ELSE 0 END) / POWER(10, 18) AS earned_celo
, SUM(CASE WHEN currency = 'cUSD' THEN amount_wei ELSE 0 END) / POWER(10, 18) AS earned_cusd
FROM trxns
WHERE rewards_category IN (
  'attestationFees',
  'slashingReward',
  'validator',
  'group',
  'voter'
)
AND earned_date > DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY 1, 2, 3
ORDER BY 3, 1
