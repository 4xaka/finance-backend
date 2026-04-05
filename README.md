# Finance Backend

A backend API for a finance dashboard system with role-based access control, financial record management, and summary analytics.

## Tech Stack

| Layer       | Choice                                     |
|-------------|--------------------------------------------|
| Runtime     | Node.js                                    |
| Framework   | Express.js                                 |
| Database    | SQLite (via `better-sqlite3`)              |
| Auth        | JWT (Bearer tokens, 24h expiry)            |
| Validation  | Zod                                        |

## Prerequisites

- Node.js v18+
- On Windows: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) are required to compile `better-sqlite3` (select "Desktop development with C++")

## Setup

```bash
cd finance-backend

# Install dependencies
npm install

# Copy and configure environment variables
copy .env.example .env

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

The server starts at `http://localhost:3000`.

On first run, a default admin account is created automatically:
- **Email:** `admin@finance.local`
- **Password:** `admin123`

> Change these credentials after your first login in production.

## Roles & Permissions

| Action                         | Viewer | Analyst | Admin |
|--------------------------------|--------|---------|-------|
| Login / view own profile       | ✓      | ✓       | ✓     |
| View dashboard summary         | ✓      | ✓       | ✓     |
| View dashboard categories      | ✓      | ✓       | ✓     |
| View monthly trends            | ✓      | ✓       | ✓     |
| View recent activity           | ✓      | ✓       | ✓     |
| List & filter records          | ✗      | ✓       | ✓     |
| Create records                 | ✗      | ✗       | ✓     |
| Update records                 | ✗      | ✗       | ✓     |
| Delete records (soft)          | ✗      | ✗       | ✓     |
| List users                     | ✗      | ✗       | ✓     |
| Create / update / deactivate users | ✗  | ✗       | ✓     |

## API Reference

All protected routes require the header:
```
Authorization: Bearer <token>
```

---

### Auth

#### `POST /api/auth/login`
Login and receive a JWT token.

**Body:**
```json
{ "email": "admin@finance.local", "password": "admin123" }
```

**Response:**
```json
{
  "token": "<jwt>",
  "user": { "id": 1, "name": "System Admin", "email": "...", "role": "admin" }
}
```

#### `GET /api/auth/me`
Returns the currently authenticated user. Requires auth.

---

### Users *(admin only)*

#### `GET /api/users`
List all users.

#### `POST /api/users`
Create a new user.
```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123", "role": "analyst" }
```

#### `PATCH /api/users/:id`
Update a user's name, role, or status.
```json
{ "role": "viewer", "status": "inactive" }
```

#### `DELETE /api/users/:id`
Deactivate a user (soft delete — sets `status = inactive`).

---

### Financial Records

#### `GET /api/records` *(analyst, admin)*
List records with optional filters and pagination.

| Query param | Description                   | Example          |
|-------------|-------------------------------|------------------|
| `type`      | `income` or `expense`         | `?type=expense`  |
| `category`  | Exact category name           | `?category=Rent` |
| `from`      | Start date (YYYY-MM-DD)       | `?from=2024-01-01` |
| `to`        | End date (YYYY-MM-DD)         | `?to=2024-12-31` |
| `page`      | Page number (default: 1)      | `?page=2`        |
| `limit`     | Records per page (default: 20, max: 100) | `?limit=50` |

#### `POST /api/records` *(admin only)*
Create a financial record.
```json
{
  "amount": 1500.00,
  "type": "income",
  "category": "Salary",
  "date": "2024-03-01",
  "notes": "March salary"
}
```

#### `PATCH /api/records/:id` *(admin only)*
Partially update a record (all fields optional).

#### `DELETE /api/records/:id` *(admin only)*
Soft-delete a record (sets `deleted_at` timestamp; never physically removed).

---

### Dashboard *(all authenticated users)*

#### `GET /api/dashboard/summary`
Returns overall totals.
```json
{
  "summary": {
    "total_income": 5000,
    "total_expenses": 3200,
    "net_balance": 1800,
    "total_records": 42
  }
}
```

#### `GET /api/dashboard/categories`
Returns totals broken down by category and type.

#### `GET /api/dashboard/trends`
Returns monthly income vs. expenses for the last 12 months.

#### `GET /api/dashboard/recent`
Returns the 10 most recently created records.

---

### Health check

#### `GET /health`
Returns `{ "status": "ok" }`. No auth required.

---

## Project Structure

```
finance-backend/
├── data/                    # SQLite database file (auto-created)
├── src/
│   ├── config/
│   │   └── database.js      # DB init, schema creation, admin seed
│   ├── middleware/
│   │   ├── auth.js          # JWT verification
│   │   ├── roles.js         # Role-based access guards
│   │   └── validate.js      # Zod body/query validation helpers
│   ├── routes/
│   │   ├── auth.js          # Login, /me
│   │   ├── users.js         # User CRUD (admin)
│   │   ├── records.js       # Financial record CRUD + filters
│   │   └── dashboard.js     # Summary, categories, trends, recent
│   └── app.js               # Express app + server entry point
├── .env.example
├── package.json
└── README.md
```

## Assumptions & Design Decisions

1. **Viewer role and records:** Viewers can access all dashboard endpoints (summary, trends, categories, recent activity) but cannot list or filter individual records — that requires at least Analyst access.
2. **Who can create records:** Only Admins can create, update, or delete financial records. Analysts are read-only on records.
3. **Soft deletes:** Records are never physically deleted — a `deleted_at` timestamp is set instead. All queries filter out soft-deleted rows.
4. **User deactivation:** Users are deactivated (status set to `inactive`) rather than deleted. Inactive users cannot log in.
5. **Password hashing:** bcrypt with cost factor 10.
6. **Date format:** All dates must be `YYYY-MM-DD`. The API validates this strictly.
7. **Partial updates:** `PATCH` endpoints accept any subset of fields. Fields not provided are left unchanged.
8. **Default admin:** A seeded admin account is created on first startup to bootstrap the system.
