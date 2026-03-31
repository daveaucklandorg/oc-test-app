import assert from 'node:assert/strict';
import test from 'node:test';

import { checkTriageTimeout } from './stale-triage-recovery.js';

test('flags triage as stale when elapsed time exceeds the timeout threshold', () => {
  const now = Date.UTC(2026, 2, 31, 22, 39, 0);
  const tenMinutesAgo = now - (10 * 60 * 1000);
  const fiveMinuteLimit = 5 * 60 * 1000;

  const result = checkTriageTimeout(tenMinutesAgo, fiveMinuteLimit, now);

  assert.equal(result.isStale, true);
  assert.equal(result.elapsedMs, 10 * 60 * 1000);
  assert.equal(result.recoveryAction, 'requeue-triage');
});

test('keeps triage active when elapsed time stays within the timeout threshold', () => {
  const now = Date.UTC(2026, 2, 31, 22, 39, 0);
  const oneMinuteAgo = now - (1 * 60 * 1000);
  const fiveMinuteLimit = 5 * 60 * 1000;

  const result = checkTriageTimeout(oneMinuteAgo, fiveMinuteLimit, now);

  assert.equal(result.isStale, false);
  assert.equal(result.elapsedMs, 1 * 60 * 1000);
  assert.equal(result.recoveryAction, 'continue-triage');
});

test('accepts ISO date strings for start time to match ticket metadata inputs', () => {
  const now = Date.UTC(2026, 2, 31, 22, 39, 0);
  const result = checkTriageTimeout('2026-03-31T22:29:00.000Z', 5 * 60 * 1000, now);

  assert.equal(result.isStale, true);
  assert.equal(result.recoveryAction, 'requeue-triage');
});
