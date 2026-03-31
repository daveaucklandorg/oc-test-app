# Ticket 190 — Cycle Lock Behaviour Research

**Date:** 2026-03-31
**Author:** Phoebe (automated research agent)
**Branch:** `ticket-190-e2e-a08-cycle-lock-test`

---

## Overview

"Cycle lock" refers to a mechanism that prevents a ticket or task from being picked up and processed by multiple agents or processing cycles concurrently. It guards against re-entrant or duplicate processing — ensuring that once a ticket enters a processing cycle, no other cycle can claim it until the first completes (or times out).

In systems with multiple consumers (e.g., agent pools, worker queues, cron-triggered processors), cycle locks are essential to prevent duplicate work, race conditions, and inconsistent state.

---

## Current Behaviour

**Finding: No cycle lock mechanism exists in this codebase.**

The `oc-test-app` repository is a minimal CRUD contact book application. After examining all source files, there is no task/ticket processing system and therefore no cycle lock implementation.

### Codebase Structure

| File | Purpose | Lock-relevant? |
|---|---|---|
| `src/server.js` | HTTP server bootstrap (raw `node:http`) | No — stateless request handler |
| `src/router.js` | REST API route dispatcher | No — synchronous request/response only |
| `src/db.js` | SQLite data access layer (`better-sqlite3`) | No — no queue/lock tables or concurrency control |
| `src/api.test.js` | API integration tests | No |
| `package.json` | Dependencies and scripts | No queue/worker dependencies |
| `PRD.md` | Product requirements | No mention of queues, workers, or locks |

### Key Observations from Code Review

1. **No task/ticket processing logic exists.** The application is a straightforward contacts CRUD API — it does not consume from any queue, poll for work, or process tickets.

2. **No queue or scheduling infrastructure.** There are no dependencies on Redis, Bull, BeeQueue, Agenda, or any other job/queue library. No cron jobs or scheduled tasks are configured.

3. **No agent loop or webhook handler for task dispatch.** The only endpoints are REST CRUD operations for contacts and a health check.

4. **Database has no lock-related schema.** The sole table is `contacts` with fields `id`, `name`, `email`, `phone`, `created_at`. There are no status flags, lock columns, `locked_by`, `locked_at`, or similar concurrency-control fields.

5. **SQLite is used in default (WAL not explicitly configured) mode via `better-sqlite3`.** The library operates synchronously within a single Node.js process, so within-process concurrency is inherently serialised. However, no cross-process locking is implemented.

---

## Observations & Edge Cases

1. **No concurrency risk in current form.** Since there is no background processing or multi-agent consumption, cycle lock is not applicable to the current application architecture.

2. **SQLite single-writer limitation.** If this application were extended to include background task processing, SQLite's single-writer model would provide implicit serialisation within one process but would not protect against multiple processes or distributed agents claiming the same work item.

3. **No idempotency guards.** The existing API endpoints (POST, PUT, DELETE) have no idempotency keys or duplicate-request protection, which is tangentially related to cycle lock concerns but not directly relevant to the current scope.

4. **If task processing were added**, the lack of any foundational locking primitives means it would need to be built from scratch — there is no partially-implemented or dormant lock mechanism to build upon.

---

## Recommendations

Since this is a simple CRUD test application with no task processing, implementing a cycle lock is not warranted in its current form. However, if task/ticket processing were to be added in the future:

1. **Add a `status` column with atomic transitions.** For SQLite-based locking, use `UPDATE ... WHERE status = 'pending'` with a check on `changes` to implement optimistic locking. This is the simplest approach for single-process deployments.

2. **Add `locked_by` and `locked_at` columns** to track which agent/process holds the lock and when it was acquired. Include a TTL-based expiry so stale locks are automatically released.

3. **Use database transactions** (`better-sqlite3` supports them natively) to ensure atomic claim-and-update operations.

4. **For multi-process or distributed deployments**, consider Redis-based distributed locks (e.g., Redlock) or a proper job queue library (e.g., BullMQ) rather than relying on SQLite.

5. **Implement idempotency keys** on processing endpoints to guard against duplicate delivery from external systems.

---

*This research document was produced as part of E2E pipeline test ticket #190.*
