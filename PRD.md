# PRD: OC Test App — Contact Book

A minimal single-page contact book web app. Pure Node.js (no frameworks), vanilla HTML/CSS/JS frontend, SQLite backend.

## Requirements

### 1. Database Layer
- SQLite database (`data/contacts.db`) using `better-sqlite3`
- Table: `contacts` — `id` (integer PK autoincrement), `name` (text, required), `email` (text), `phone` (text), `created_at` (datetime default now)
- Module: `src/db.js` exporting `getAll()`, `getById(id)`, `create({name, email, phone})`, `update(id, {name, email, phone})`, `deleteById(id)`

### 2. REST API
- `GET /api/contacts` — list all contacts (JSON array)
- `GET /api/contacts/:id` — single contact (404 if missing)
- `POST /api/contacts` — create (JSON body, return 201 + created object)
- `PUT /api/contacts/:id` — update (JSON body, return 200 + updated object, 404 if missing)
- `DELETE /api/contacts/:id` — delete (return 204, 404 if missing)
- `GET /api/health` — return `{ status: "ok" }`

### 3. Frontend
- Serve `public/index.html` for all non-API routes
- Single page with:
  - A table/list showing all contacts (name, email, phone)
  - An "Add Contact" form (name, email, phone fields + submit button)
  - Each row has "Edit" and "Delete" buttons
  - Edit opens inline editing or a simple form
- Vanilla HTML/CSS/JS — no build step, no frameworks
- Minimal but clean styling (centered layout, readable fonts)

### 4. Tests
- Use Node.js built-in test runner (`node --test`)
- Test file: `src/api.test.js`
- Tests:
  - Health endpoint returns 200
  - Create a contact → 201
  - List contacts includes created contact
  - Get contact by ID → 200
  - Update contact → 200
  - Delete contact → 204
  - Get deleted contact → 404

## Technical Constraints
- Node.js only, no TypeScript
- `better-sqlite3` for database (must be in `dependencies`)
- No Express — use raw `http` module with a simple router
- Tests must pass with `npm test`
- All code in `src/` and `public/`

## Acceptance Criteria
- `npm install && npm test` passes all tests
- `npm run dev` starts the server and the frontend is usable at `http://localhost:3456`
- CRUD operations work end-to-end via the UI
