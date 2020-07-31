import assert from 'assert';
import sinon from 'ts-sinon';

import log, { IDENTIFIER as LOG_IDENTIFIER } from './log';

describe('#log', function () {
  it('logs strings', function () {
    const message = 'This is some message';
    const expected = JSON.stringify({ message, identifier: LOG_IDENTIFIER });
    const spy = sinon.spy(console, 'log');
    log(message);
    assert(spy.calledWith(expected));
    spy.restore();
  });

  it('logs objects', function () {
    const loggable = {
      value: 'Test value',
      message: 'Some interesting message',
    };

    const expected = {
      ...loggable,
      identifier: LOG_IDENTIFIER,
    };

    const spy = sinon.spy(console, 'log');
    log(loggable);
    assert(spy.calledWith(JSON.stringify(expected)));
    spy.restore();
  });
});
