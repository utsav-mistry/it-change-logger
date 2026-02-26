# IT Change / Incident Logger

Production-ready internal IT Change and Incident Management System.
Built with MERN (MongoDB, Express, React, Node.js).

---

## Overview

This is an internal IT operations tool — not a public ticket portal. Only authorised IT staff have access. All actions are fully audited.

### Key Features

- TOTP two-factor authentication (RFC-6238: Google Authenticator, Authy, etc.)
- Immutable incident creation fields — audit integrity guaranteed
- Full audit log and state timeline per incident
- Full-text search with indexed MongoDB queries
- In-app report viewer with charts, filters, and date range selection
- CSV and PDF report generation (incidents and work logs)
- Report download audit trail
- Daily Work Log module — one log per user per day, locked after submission
- Dashboard with incident charts
- Role-based access (Admin / IT Admin)
- Department management with head assignment
- In-app notifications
- Stable auto-incremented Incident IDs (never reused)
- Dark / Light mode with session persistence
- Single port (4000) — backend serves frontend static build
- PM2 process management with auto-start on boot

---

## Production Deployment (Ubuntu Minimal)

### Prerequisites

- Ubuntu 20.04 or later (minimal install)
- Root or sudo access
- Port 4000 open in firewall

### One-Command Setup

```bash
git clone https://github.com/utsav-mistry/it-change-logger.git /opt/it-change-logger
cd /opt/it-change-logger
chmod +x setup.sh
sudo ./setup.sh
```

`setup.sh` will automatically:

1. Install system packages (curl, wget, gnupg2, python3, make, g++)
2. Install Node.js LTS via NodeSource
3. Install MongoDB 7.x from the official repository
4. Install backend dependencies
5. Install frontend dependencies
6. Inject author credits into `About.jsx` and `Terms.jsx`
7. Verify credit injection (setup fails if verification fails)
8. Build the React frontend (production webpack build)
9. Generate a secure JWT secret
10. Start the backend with PM2
11. Configure PM2 to auto-start on boot

### After Setup

Open in browser:
```
http://<server-ip>:4000
```

On first visit the Initial Setup Wizard will guide you through:

- Setting company name and logo
- Creating the first Admin or IT Admin account
- Enrolling your TOTP authenticator

---

## Authentication Flow

1. Enter username and password
2. Enter 6-digit TOTP code from your authenticator app
3. First login: enroll your authenticator by scanning a QR code

### Changing Authenticator

- Admin / IT Admin: Can reset their own authenticator directly from the Profile page
- Other users: Submit a change request — awaits approval from Admin, IT Admin, or Department Head

---

## Project Structure

```
.
├── setup.sh                    # Production setup script
├── backend/
│   ├── package.json
│   ├── .env                    # Created by setup.sh — not in repo
│   ├── logs/                   # Rotating log files
│   └── src/
│       ├── server.js           # Express entry point
│       ├── config/db.js        # MongoDB connection
│       ├── models/
│       │   ├── User.js
│       │   ├── Department.js
│       │   ├── Incident.js
│       │   ├── AuditLog.js
│       │   ├── Notification.js
│       │   ├── WorkLog.js
│       │   ├── ReportDownload.js
│       │   ├── AuthenticatorChangeRequest.js
│       │   └── CompanySettings.js
│       ├── controllers/
│       ├── routes/
│       ├── middleware/
│       └── utils/logger.js
└── frontend/
    ├── package.json
    ├── webpack.config.js       # Manual webpack — no Vite or CRA
    ├── .babelrc
    ├── public/index.html
    └── src/
        ├── index.js
        ├── App.js
        ├── index.css
        ├── api/client.js
        ├── context/            # AuthContext (with theme), ToastContext
        ├── components/         # Layout, UI helpers, RichEditor
        └── pages/
            ├── Dashboard.js
            ├── IncidentList.js
            ├── IncidentCreate.js
            ├── IncidentDetail.js
            ├── WorkLog.js
            ├── WorkLogAdmin.js
            ├── Reports.js
            ├── ReportAudit.js
            ├── UserManagement.js
            ├── DepartmentManagement.js
            ├── NotificationPage.js
            ├── Profile.js
            ├── Settings.js
            ├── About.jsx
            └── Terms.jsx
```

---

## Database Collections

| Collection | Purpose |
|---|---|
| users | IT staff accounts with TOTP secrets |
| departments | Departments with head references |
| incidents | Incident records (immutable create fields) |
| auditLogs | Field-level change history per incident |
| notifications | In-app notifications |
| workLogs | Daily staff work logs (one per user per day) |
| reportDownloads | Report export audit trail |
| authenticatorChangeRequests | TOTP re-enrollment approvals |
| companySettings | Company name, logo, and setup state |

---

## API Reference

### Setup

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/setup/status | Public | Check if initialized |
| POST | /api/setup/complete | Public | First-time setup |
| POST | /api/setup/confirm-totp | Public | Enroll setup user TOTP |
| GET | /api/setup/company | Public | Get company branding |
| PUT | /api/setup/company | Admin | Update company settings |

### Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/login | Public | Step 1: credentials |
| POST | /api/auth/verify-totp | Public | Step 2: TOTP verify |
| POST | /api/auth/enroll-totp | Public | TOTP first enrollment |
| GET | /api/auth/totp-qr/:userId | Public | QR code for enrollment |
| GET | /api/auth/profile | Bearer | Get logged-in user |

### Incidents

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/incidents | Bearer | List with filters and search |
| POST | /api/incidents | Bearer | Create incident |
| GET | /api/incidents/:id | Bearer | Get one incident |
| PUT | /api/incidents/:id | Bearer | Update mutable fields |
| GET | /api/incidents/:id/audit | Bearer | Full audit log |
| GET | /api/incidents/:id/timeline | Bearer | State timeline |

### Work Logs

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/worklogs/my/today | Bearer | Get or create today's draft |
| POST | /api/worklogs/my/draft | Bearer | Save draft |
| POST | /api/worklogs/my/submit | Bearer | Submit and lock |
| GET | /api/worklogs/my/history | Bearer | My historical entries |
| GET | /api/worklogs/admin/all | Admin | All entries (filterable) |
| GET | /api/worklogs/admin/export/csv | Admin | Export CSV |
| GET | /api/worklogs/admin/export/pdf | Admin | Export PDF |

### Reports

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /api/reports/data | Admin | In-app report data (charts) |
| GET | /api/reports/csv | Admin | Download CSV |
| GET | /api/reports/pdf | Admin | Download PDF |
| GET | /api/reports/dashboard | Admin | Dashboard stats |
| GET | /api/reports/download-audit | Admin | Download audit trail |

### Users, Departments, Notifications

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET/POST | /api/users | Admin | List/Create users |
| PUT/DELETE | /api/users/:id | Admin | Update/Deactivate user |
| POST | /api/users/request-totp-change | Bearer | Request TOTP change |
| GET | /api/users/totp-requests | Bearer | List TOTP requests |
| POST | /api/users/totp-requests/:id/review | Bearer | Approve/Reject TOTP |
| POST | /api/users/change-password | Bearer | Change own password |
| GET/POST | /api/departments | Bearer/Admin | List/Create |
| PUT/DELETE | /api/departments/:id | Admin | Update/Delete |
| GET | /api/notifications | Bearer | Get notifications |
| POST | /api/notifications/mark-read | Bearer | Mark as read |

---

## Frontend Routes

| Path | Component | Description |
|---|---|---|
| / | Dashboard | Default redirect |
| /dashboard | Dashboard | Incident charts and overview |
| /incidents | IncidentList | Search, filter, paginate |
| /incidents/new | IncidentCreate | Create form |
| /incidents/:id | IncidentDetail | View / Edit / Timeline / Audit |
| /worklog | WorkLog | My daily work log |
| /worklogs/admin | WorkLogAdmin | Admin: all work logs |
| /users | UserManagement | CRUD and TOTP approval (Admin) |
| /departments | DepartmentManagement | CRUD and head assignment (Admin) |
| /reports | Reports | In-app report view and export |
| /reports/audit | ReportAudit | Download audit trail |
| /notifications | NotificationPage | In-app notifications |
| /profile | Profile | Password and authenticator |
| /settings | Settings | Company branding (Admin) |
| /about | About | Application info and credits |
| /terms | Terms | Terms and conditions |

---

## Incident Field Rules

### Immutable after creation

Incident ID, Raised At, Raised By, Priority, Channel, Product, Issue, Created In Tool By

### Mutable after creation

Observation, Steps, Resolution, Resolution Time, Handled By, Incident State, Archive flag

### States

Open → In Progress → On Hold → Resolved → Archived

Archive is only for wrongly created incidents. Records are never deleted.

---

## Report Module

Reports are viewable inside the application before downloading.

Each report includes:

- Total incidents, resolved vs. unresolved
- Incidents by priority (bar chart)
- Incidents by state (bar chart)
- Incidents by channel (bar chart)
- Top handlers (bar chart)
- Time-of-day distribution of raised incidents (hour distribution chart)
- Incidents over time (line chart)
- Average resolution time
- Full incident list

PDF export includes all sections with structured tables, bars, and a page header with company name, report title, period, and generated timestamp.

Every export creates an audit record in the reportDownloads collection, viewable at /reports/audit.

---

## Daily Work Log Module

Each IT staff member submits one work log per calendar day:

- Entry can be drafted and saved before submission
- After submission, the entry is locked — no editing, no deletion
- Admin and IT Admin can view all entries filtered by user, department, or date
- Admin and IT Admin can export work logs as CSV or PDF
- Every submission records IP address and submission timestamp
- Audit record is created on submission

---

## Operations

### PM2 Commands

```bash
pm2 status                    # View process status
pm2 logs it-change-logger     # Tail logs
pm2 restart it-change-logger  # Restart
pm2 reload it-change-logger   # Zero-downtime reload
pm2 stop it-change-logger     # Stop
```

### Log Files

```
backend/logs/app-YYYY-MM-DD.log
backend/logs/error-YYYY-MM-DD.log
backend/logs/pm2.log
```

Logs rotate daily, max 10 MB per file, 14 days retention.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| NODE_ENV | production | Environment |
| PORT | 4000 | Listen port |
| MONGO_URI | mongodb://localhost:27017/it_change_logger | MongoDB connection |
| JWT_SECRET | (auto-generated by setup.sh) | JWT signing secret |
| JWT_EXPIRES | 8h | Token expiry |

---

## Security

- Passwords hashed with bcryptjs (12 rounds)
- TOTP verified server-side with otplib
- JWT authentication with 8h expiry
- Helmet.js HTTP security headers
- Rate limiting on auth endpoints (30 requests per 15 minutes)
- Input validation via express-validator
- No request payloads logged

---

## Attribution

Developed by Utsav Mistry.

GitHub: https://github.com/utsav-mistry

Internal use only. All data is owned by the deploying organisation. Redistribution or modification must retain this attribution.
