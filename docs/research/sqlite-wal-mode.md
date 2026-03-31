# SQLite WAL Mode — Research Report

**Ticket:** #194 — [E2E-A11] Research SQLite WAL mode  
**Date:** 2026-03-31  
**Author:** Phoebe (automated research)

---

## 1. Current State

### Database Library & Configuration

This project uses **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** (v12.8.x) — a synchronous, native SQLite binding for Node.js.

**Relevant file:** `src/db.js`

```js
import Database from 'better-sqlite3';

const db = new Database(dbPath);
```

The database is opened with default options. No PRAGMA statements are issued after connection. This means:

- **Journal mode:** `delete` (SQLite default — rollback journal)
- **Synchronous:** `full` (SQLite default)
- **No WAL file** (`data/contacts.db-wal`) or shared-memory file (`data/contacts.db-shm`) will exist
- **Database path:** `data/contacts.db`

### Schema

A single `contacts` table with five columns (`id`, `name`, `email`, `phone`, `created_at`). All queries are simple CRUD operations via prepared statements.

### Query Pattern

The router (`src/router.js`) serves a REST API (`/api/contacts`) with:

- `GET /api/contacts` — `SELECT` all contacts (read)
- `GET /api/contacts/:id` — `SELECT` single contact (read)
- `POST /api/contacts` — `INSERT` (write)
- `PUT /api/contacts/:id` — `UPDATE` (write)
- `DELETE /api/contacts/:id` — `DELETE` (write)

The workload is typical CRUD. If a dashboard were added, it would likely be read-heavy (listing/filtering contacts), making WAL mode relevant.

---

## 2. What WAL Mode Is

SQLite supports two primary journal modes:

### Rollback Journal (default: `delete`)

- Before modifying a page, SQLite copies the **original page** to a separate journal file.
- On commit, the journal is deleted (or truncated/zeroed depending on the journal mode variant).
- **Readers and writers are mutually exclusive** — a write lock blocks all readers, and active readers block writers.

### Write-Ahead Logging (WAL)

- Instead of writing changes directly to the database file, SQLite appends them to a **WAL file** (`*.db-wal`).
- Readers continue reading from the main database file (or earlier WAL frames), unaffected by ongoing writes.
- A **checkpoint** operation periodically transfers WAL contents back into the main database file.
- A **shared-memory file** (`*.db-shm`) coordinates access between connections.

**Key difference:** WAL inverts the locking model — readers never block writers, and writers never block readers. Multiple concurrent readers can proceed simultaneously.

---

## 3. Concurrency Benefits

### Why WAL Matters for Read-Heavy Workloads

| Scenario | Rollback Journal | WAL Mode |
|---|---|---|
| Multiple concurrent reads | ✅ Allowed | ✅ Allowed |
| Read during write | ❌ Blocked | ✅ Allowed |
| Write during reads | ❌ Blocked | ✅ Allowed |
| Multiple concurrent writes | ❌ One at a time | ❌ One at a time |

For a dashboard scenario where many users query contacts simultaneously while occasional writes (create/update/delete) occur:

- **Rollback journal:** A single write operation would block all dashboard readers until the transaction completes. Under load, this causes request queuing and increased latency.
- **WAL mode:** Dashboard read queries proceed uninterrupted during writes. Only write-vs-write contention remains serialized (which is unavoidable in SQLite).

### Relevance to This Project

- `better-sqlite3` is synchronous and runs on Node's main thread. Concurrent HTTP requests are handled by Node's event loop, but database calls are blocking.
- With WAL mode, if a write is in progress from one request, subsequent read requests arriving on the event loop can still be served from the pre-write state, reducing effective contention.
- For a single-process Node app, the benefit is modest since operations are serialized on the event loop. The benefit becomes significant if:
  - The app uses worker threads for database access
  - Multiple processes share the same database file
  - Write transactions are long-running (e.g., bulk imports)

---

## 4. Trade-offs & Risks

### Increased Disk Usage

- WAL mode creates two additional files: `*.db-wal` and `*.db-shm`.
- The WAL file grows until checkpointed. Without explicit checkpointing, it can grow unboundedly under heavy write load.
- `better-sqlite3` does **not** auto-checkpoint by default in the same way the C library does (the default auto-checkpoint threshold is 1000 pages, which is inherited).
- **Mitigation:** The auto-checkpoint threshold (1000 pages ≈ 4MB) is usually sufficient. For heavy-write scenarios, explicit `PRAGMA wal_checkpoint(TRUNCATE)` can be scheduled.

### Network Filesystem (NFS) Incompatibility

- WAL mode requires shared-memory (`mmap`) primitives that **do not work reliably on network filesystems** (NFS, SMB, CIFS).
- If `data/contacts.db` is on a network mount, WAL mode will either fail to enable or cause silent corruption.
- **This project stores the DB locally** (`data/` relative to project root), so this is not a current risk — but it's a deployment constraint to document.

### Checkpoint Overhead

- Checkpointing (transferring WAL content back to the main DB) happens automatically but can cause brief write pauses when the WAL is large.
- In pathological cases, if many readers hold old snapshots open, checkpointing cannot reclaim WAL space, leading to unbounded WAL growth.
- **Mitigation:** Keep transactions short (this project already does — single statement per request).

### Write Performance

- Individual writes are marginally **slower** in WAL mode because data is written to the WAL file first, then later checkpointed to the main DB (double-write).
- For write-heavy workloads with few reads, WAL mode is a net negative.
- **This project's write workload is light** (individual contact CRUD), so the overhead is negligible.

### Crash Recovery

- WAL mode crash recovery is well-tested and reliable on local filesystems.
- On crash, SQLite replays the WAL on next open — no data loss for committed transactions.
- The WAL file must be kept alongside the DB file; deleting it manually causes data loss for uncommitted WAL frames.

---

## 5. Implementation Steps

### Option A: Enable WAL at Database Open (Recommended)

In `src/db.js`, add a single PRAGMA after opening the database:

```js
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
```

**Why this works:**
- `better-sqlite3`'s `.pragma()` method is the idiomatic way to set PRAGMAs.
- `journal_mode = WAL` is **persistent** — once set, it survives database close/reopen. However, setting it on each open is defensive and costs nothing.
- This is a one-line change with no other code modifications required.

### Option B: Enable WAL with Tuned Settings

For a more production-ready configuration:

```js
const db = new Database(dbPath);

// Enable WAL mode for concurrent read performance
db.pragma('journal_mode = WAL');

// Set synchronous to NORMAL (safe with WAL, reduces fsync overhead)
db.pragma('synchronous = NORMAL');

// Set busy timeout to avoid SQLITE_BUSY errors under contention
db.pragma('busy_timeout = 5000');
```

**Notes on Option B:**
- `synchronous = NORMAL` is safe with WAL mode (WAL guarantees durability via its own sync mechanism). This reduces write latency by ~2x compared to the default `FULL`.
- `busy_timeout` tells SQLite to retry for up to 5 seconds when encountering a lock, rather than immediately returning `SQLITE_BUSY`. This is good practice regardless of journal mode.

### Verification

After implementation, verify WAL is active:

```js
const mode = db.pragma('journal_mode', { simple: true });
console.log(`Journal mode: ${mode}`); // Should print: "wal"
```

Or check the filesystem — `data/contacts.db-wal` and `data/contacts.db-shm` should appear after the first write.

### Rollback

To revert to rollback journal:

```js
db.pragma('journal_mode = DELETE');
```

This removes the WAL and SHM files and returns to default behaviour.

---

## 6. Recommendation

**✅ Yes — enable WAL mode.**

**Rationale:**

1. **Low risk:** This is a single-table CRUD app with a light write workload. WAL's trade-offs (disk usage, write overhead) are negligible at this scale.

2. **Concrete benefit:** Even in a single-process Node app, WAL eliminates read-write contention during concurrent HTTP requests. If the app scales to multiple processes or adds worker threads, the benefit compounds.

3. **One-line change:** Implementation is trivial (`db.pragma('journal_mode = WAL')`) with zero risk of breaking existing functionality.

4. **Best practice:** WAL mode is the recommended default for SQLite applications serving web traffic. The SQLite documentation itself notes that "WAL mode is always at least as fast and usually significantly faster than rollback journal modes" for most workloads.

**Recommended implementation:** Option B (WAL + `synchronous = NORMAL` + `busy_timeout = 5000`) for the best balance of performance and reliability.

**Conditions where WAL should NOT be used:**
- Database file is on a network filesystem (NFS/SMB)
- The application is write-only with no concurrent reads
- The deployment requires the database to be a single file (no WAL/SHM sidecar files)
