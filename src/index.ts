require('dotenv').config({ path: `.env-${process.env.ENV_FILE || 'mainnet'}` });

import express from 'express';
import log from './common/log';
import { createUserInput, successOrFailure, returnActionValue } from './routing';

import initiateBackfill from './actions/initiateBackfill';
import backfillEra from './actions/backfill';
import currentStatus from './actions/currentStatus';
import createRevision from './actions/createRevision';
import processLatestEpoch from './actions/processLatestEpoch';
import reconcile from './actions/reconcile';
import configuration from './actions/configuration';

const app = express();

// Generic Middleware
app.use(express.json());
app.use((req, res, next) => {
  // userInput now contains both body parameters and query parameters
  req.userInput = createUserInput(req.query, req.body);
  next();
});

app.use((req, res, next) => {
  log({
    path: req.path,
    input: req.userInput,
    ip: req.ip,
  });
  next();
});

// Routes
app.use('/initiate-backfill', successOrFailure(initiateBackfill));
app.use('/backfill-epoch', successOrFailure(backfillEra));
app.use(
  '/current-status',
  returnActionValue(currentStatus, {
    currentRevision: 0,
    latestEpoch: 0,
    allEpochs: [],
    error: true,
  }),
);
app.use('/create-revision', returnActionValue(createRevision, NaN));
app.use('/process-latest-epoch', successOrFailure(processLatestEpoch));
app.use('/reconcile', returnActionValue(reconcile, []));
app.use('/configuration', returnActionValue(configuration, {}));

// Default
app.use((req, res) => {
  log('This request did not match any of the route handlers');
  res.status(404).send('❌');
});

module.exports = { main: app };
