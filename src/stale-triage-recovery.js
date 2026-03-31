export function checkTriageTimeout(startTime, maxDurationMs, now = Date.now()) {
  const startedAt = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();

  if (!Number.isFinite(startedAt)) {
    throw new TypeError('startTime must be a valid timestamp or date value');
  }

  if (!Number.isFinite(maxDurationMs) || maxDurationMs < 0) {
    throw new TypeError('maxDurationMs must be a non-negative number');
  }

  const elapsedMs = Math.max(0, now - startedAt);
  const isStale = elapsedMs > maxDurationMs;

  return {
    isStale,
    elapsedMs,
    recoveryAction: isStale ? 'requeue-triage' : 'continue-triage',
  };
}
