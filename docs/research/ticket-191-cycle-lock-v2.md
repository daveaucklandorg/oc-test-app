# Ticket 191 — Cycle Lock Behaviour Research (v2)

**Date:** 2026-03-31
**Author:** Phoebe (automated research agent)
**Branch:** `ticket-191-e2e-a08-cycle-lock-test-v2`
**Prior work:** Ticket 190 — `ticket-190-e2e-a08-cycle-lock-test` (v1)

---

## Summary

This document is the **v2 follow-up** to the cycle lock research performed in ticket #190. The v1 finding was that the `oc-test-app` codebase contains **no cycle lock mechanism** — the application is a minimal CRUD contact book with no task processing, queuing, or concurrency control.

v2 confirms that finding remains unchanged and extends the research with:
1. A concrete proof-of-concept test demonstrating what happens when two simultaneous requests hit the same resource.
2. Analysis of SQLite-level serialisation behaviour via `better-sqlite3`.
3. Specific observations about simultaneous trigger behaviour in the absence of application-level locks.

---

## Codebase Review (unchanged from v1)

The repository contains a minimal Node.js HTTP server with a contacts CRUD API:

| File | Purpose | Lock-relevant? |
|---|---|---|
| `src/server.js` | HTTP server bootstrap (`node:http`) | No — stateless request handler |
| `src/router.js` | REST API route dispatcher | No — synchronous request/response |
| `src/db.js` | SQLite data access layer (`better-sqlite3`) | No lock tables or concurrency control |
| `src/api.test.js` | API integration tests (Node built-in runner) | No |
| `package.json` | Dependencies and scripts | No queue/worker deps |
| `PRD.md` | Product requirements | No mention of locks/queues |

**No cycle lock, mutex, semaphore, or concurrency guard exists anywhere in the codebase.**

---

## What "Cycle Lock" Means (Context)

In orchestration systems (like the Daveclaw pipeline that dispatches work to this test app), a "cycle lock" prevents a ticket/task from being picked up by multiple agents or processing cycles concurrently. It guards against:

- **Double execution** — two agents processing the same ticket simultaneously.
- **Race conditions** — concurrent state mutations producing inconsistent results.
- **Wasted work** — duplicate effort when one result would be discarded.

Since `oc-test-app` is a passive CRUD API (not a task consumer), cycle lock is an external/orchestration concern, not an application concern. The app itself has no concept of "cycles" or "triggers" in the orchestration sense.

---

## What Happens When Two Triggers Fire Simultaneously

### Scenario: Two concurrent HTTP requests to the same endpoint

Since the app has no internal trigger/event system, "simultaneous triggers" in practice means concurrent HTTP requests arriving at the API.

#### SQLite Serialisation (`better-sqlite3`)

`better-sqlite3` is a **synchronous** SQLite binding. All database operations execute on the main thread and are serialised by the Node.js event loop. This means:

1. **Within a single Node.js process**, two concurrent requests cannot execute SQL statements truly in parallel — they are interleaved at the async I/O boundary (reading request bodies) but serialised at the database layer.
2. **There is no explicit locking**, but the synchronous nature of `better-sqlite3` provides implicit serialisation for write operations.
3. **No request is queued or dropped** — both execute, but sequentially at the DB level.

#### Concrete Behaviour

Given two simultaneous `POST /api/contacts` requests:
- Both requests are accepted by the HTTP server concurrently.
- Both request bodies are read asynchronously (potentially in parallel).
- Both `INSERT` statements execute synchronously via `better-sqlite3` — one completes before the other starts.
- Both succeed — two distinct contacts are created with sequential IDs.
- **No lock prevents this.** No deduplication occurs.

Given two simultaneous `DELETE /api/contacts/1` requests:
- The first `DELETE` succeeds (returns 204).
- The second `DELETE` finds no row to delete (returns 404).
- **No race condition** because `better-sqlite3` serialises the two `DELETE` calls.

Given two simultaneous `PUT /api/contacts/1` requests with different payloads:
- Both execute sequentially — last writer wins.
- **No conflict detection or optimistic locking** — the second write silently overwrites the first.
- This is a potential data integrity issue but not a crash or error condition.

---

## Differences from v1

| Aspect | v1 (Ticket 190) | v2 (Ticket 191) |
|---|---|---|
| Core finding | No cycle lock exists | Confirmed — still no cycle lock |
| Simultaneous trigger analysis | Theoretical | Concrete scenarios documented |
| Test coverage | None | Proof-of-concept test added (see below) |
| SQLite serialisation analysis | Mentioned briefly | Detailed behaviour documented |
| Last-writer-wins risk | Not flagged | Explicitly identified for PUT |

---

## Edge Cases and Failure Modes

1. **Last-writer-wins on PUT** — No optimistic locking (e.g., ETag/version column). Concurrent updates silently overwrite each other. In a multi-agent orchestration context, this could cause data loss if two agents modify the same contact.

2. **No idempotency on POST** — Duplicate `POST` requests create duplicate records. No idempotency key mechanism exists.

3. **Single-process assumption** — The implicit serialisation from `better-sqlite3` only holds within one Node.js process. If multiple instances were run (e.g., behind a load balancer), SQLite's file-level locking would serialize writes but with potential `SQLITE_BUSY` errors that are unhandled in the current code.

4. **No request deduplication** — The HTTP server has no middleware to detect or reject duplicate requests within a time window.

---

## Proof-of-Concept Test

A test file has been added at `tests/e2e/cycle-lock-v2.test.js` that:
- Fires two `POST` requests simultaneously using `Promise.all` and verifies both succeed (no lock prevents double creation).
- Fires two `DELETE` requests simultaneously on the same resource and verifies exactly one succeeds (204) while the other gets 404 (implicit serialisation).
- Fires two `PUT` requests simultaneously and verifies last-writer-wins behaviour.

This demonstrates the absence of cycle lock protection at the application level.

---

## Recommendations (unchanged from v1, refined)

If cycle lock behaviour were needed in this application:

1. **For orchestration-level locking**: Implement in the dispatch layer (e.g., Daveclaw dashboard), not in this CRUD app. Mark tickets as `locked` before dispatching to agents.
2. **For API-level concurrency control**: Add an `updated_at` or `version` column and use optimistic locking (`UPDATE ... WHERE version = @expected`).
3. **For idempotent writes**: Accept an `Idempotency-Key` header on POST and deduplicate within a TTL window.
4. **For multi-process deployments**: Use WAL mode and handle `SQLITE_BUSY` errors, or switch to PostgreSQL/Redis-backed queues.

---

*This research document was produced as part of E2E pipeline test ticket #191 (cycle lock test v2).*
