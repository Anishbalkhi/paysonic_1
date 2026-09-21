# Paysonic Fintech & Tolling Dashboard — Technical Project Specification

> **Platform Version:** 1.0.0-enterprise  
> **Target Audience:** Engineering Leads, Frontend Architects, Backend/Java Integrators, Operations  
> **Status:** Production-Ready Reference Implementation  

---

## 1. Executive Summary

**Paysonic Dashboard** is an enterprise-grade financial technology and toll/plaza payment orchestration dashboard. Engineered specifically to meet the high-throughput, low-latency, and stringent compliance requirements of multi-modal payment infrastructure, the platform consolidates:

- Toll plaza point-of-sale (POS) terminals
- Electronic toll collection (FASTag/Tag Details)
- Multi-concessionaire commercial networks
- Bank clearing and financial reconciliation (TRS / Cycle-wise reports)
- Dispute and violation lifecycle management
- Fine-grained, role-based access control (RBAC)

The project is structured according to **Clean Architecture** principles in **React 19** and **Vite 8**, eliminating tight coupling between UI views and backend transports while guaranteeing instant dev/prod environment portability.

---

## 2. Core Architectural Principles (Clean Architecture)

```
┌────────────────────────────────────────────────────────┐
│                   Presentation Layer                   │
│      React Pages (Home, UserList, ProductDetail)        │
│       Sub-Components & Pure UI Primitives (Button)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼ (Delegates via Service APIs)
┌────────────────────────────────────────────────────────┐
│                   Domain Service Layer                 │
│         UserService  |  HomeService  | ProductService   │
└─────────────┬────────────────────────────┬─────────────┘
              │ (IS_DEV_MODE = true)       │ (IS_DEV_MODE = false)
              ▼                            ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│    Mock Data Contracts    │ │     HTTP Transport       │
│  src/data/*.json          │ │  Axios (httpClient.js)   │
│  Live Frontend Schemas    │ │  Auth, Headers, Base URL │
└───────────────────────────┘ └────────────┬─────────────┘
                                           ▼
                              ┌──────────────────────────┐
                              │    Real Java Backend     │
                              │    Spring Boot REST API  │
                              └──────────────────────────┘
```

### 2.1 Separation of Concerns
UI pages and components are completely decoupled from network transports. Components **never** import or invoke `axios` directly; they consume domain methods via singleton service classes (e.g., `UserService.getUsers()`).

### 2.2 Single Responsibility Principle (SRP)
Every business domain maintains an isolated service class:
- `UserService.js`: Manages identity, plaza assignments, account locking, approvals, and module permissions.
- `HomeService.js`: Manages dashboard KPI metrics, revenue telemetry, and instant liquidity settlements.
- `ProductService.js`: Manages gateway orchestration rules, API credentials, and webhook endpoints.

### 2.3 Single-Toggle Dev/Prod Portability
The environment mode is governed by a single flag in `src/services/config/env.js`:
```javascript
export const IS_DEV_MODE = process.env.REACT_APP_MODE === 'dev';
```
- **Development Mode (`IS_DEV_MODE = true`)**: Services return in-memory mock JSON contracts with simulated async latency, permitting local development, rapid prototyping, and end-to-end testing without needing a running backend.
- **Production Mode (`IS_DEV_MODE = false`)**: Services route requests through `httpClient.js` with Bearer token authentication and interceptors pointing to the live Spring Boot API (`REACT_APP_API_BASE_URL`).
- **Zero code rewrites** are needed to transition from offline mock development to live backend integration.

### 2.4 Living Data Contracts
The JSON datasets in `src/data/` (`userList.json`, `home.json`, `productDetail.json`) act as formal contract specifications between frontend engineers and backend API authors, eliminating integration surprises.

### 2.5 3-Tier SCSS Layering
Styles cascade cleanly without CSS collisions or global contamination:
1. **Tier 1 — Theme Tokens (`_variables.scss` & `main.scss`)**: Core brand colors (`--brand-blue: #3762F2`, `--brand-green: #17A34A`, `--sidebar: #0F172A`), fonts (*Manrope* and *Plus Jakarta Sans*), radii, and elevation shadows.
2. **Tier 2 — Shared Utilities (`common.scss`)**: Global layout classes (`.container`, `.flex-row`, `.card`, `.badge`, `.table-wrapper`, `.btn`).
3. **Tier 3 — Page-Scoped Styles (e.g., `UserList.scss`)**: Component-specific layout and overrides imported via Dart Sass `@use`.

---

## 3. Module & Functional Breakdown

### 3.1 User & Merchant Management (`/users`)
Consolidates four previously fragmented operational tools (*Create User*, *Approve User*, *Assign Plaza*, and *Lock/Unlock User*) into a single administrative command center:

- **Telemetry Row**:
  - **Total Users**: Real-time count of registered identities.
  - **Pending Approval**: Accounts requiring supervisor sign-off before API or POS access.
  - **Locked Accounts**: Suspended or rate-limited accounts flagged for security review.
  - **Active Plazas Covered**: Total physical and virtual plazas under management.
- **Dynamic Search & Multi-Filter Bar**:
  - Full-text search across user display names, usernames, and system IDs (`PSN0001`–`PSN0006`).
  - Dropdown filters for Role, Account Status, and Assigned Plaza.
- **Consolidated Table Grid**:
  - User identity pill with color-coded avatar initials (`RS`, `MJ`, `AP`, `HR`, `SK`, `PN`).
  - Dual metadata display: System ID, username, assigned role, user subtype, and active module permission count.
  - Status badges (*Active* / *Inactive*) and approval badges (*Approved* / *Pending*).
  - Row action toolbar: Edit, Approve (conditional), Lock/Unlock (with visual red lock indicator), and Delete.
- **Add / Edit User Modal with Conditional Role Rules**:
  - **User Type Field**: Automatically hidden for administrative/banking tiers (`Master Admin`, `Admin`, `Bank`).
  - **Single Plaza Selector**: Rendered for dedicated operators (`Plaza Admin`, `Plaza POS`, `Request Tag Details`).
  - **Multi-Plaza Interactive Chips**: Rendered for `Concessionaire` accounts managing multiple plaza corridors.
  - **Auto-Plaza Callout**: Displays for `Master Admin` and `Admin` (*"All plazas are assigned to this role automatically"*).
  - **No-Plaza Hint**: Displays for `Bank` accounts (*"Plaza assignment is not applicable for this role"*).
- **Fine-Grained Module & Menu Access Tree**:
  - Implements the complete permission matrix across 10 enterprise tolling modules:
    1. *Dashboard*
    2. *User Management*
    3. *Tag Details* (Request Tag Details, Blacklist Search History)
    4. *Recon Management* (Upload Recon File, Recon Status, TRS Report, Cycle-Wise, Violation Settlement)
    5. *Dispute Handling* (Dispute Dashboard, Upload, Chargeback Assign, Validate, Approve)
    6. *Violation Management* (Violation Dashboard, Validate, Settlement Report, Raw Files, Bulk Action)
    7. *Transactional Report* (Toll Fare, Settled, Rejected, Search)
    8. *Pass Issuance* (Issuance, Approval, View, Customer Approval)
    9. *Summary Report* (Transaction, NHAI Traffic Report, Settlement Summary)
    10. *On-Boarding* (Approver, Group, Company, Division, Project, Plaza, Doc Upload)
  - Allows selecting default permissions and ticking additional modules on a per-user basis.
- **Bulk Upload Modal**:
  - Drag-and-drop CSV parser dropzone.
  - CSV template download action.
  - Schema requirements check: `username, email, contact, role, user_type, plaza, name, password`.

---

### 3.2 Financial Analytics Overview (`/`)
The executive gateway providing real-time telemetry into processed transactions and liquidity:
- **Financial KPI Cards**: Processed volume ($2.84M+), transaction volume (94.8K+), active merchants (14.2K+), and authorization success rate (99.42%).
- **Interactive Performance Chart**: Bar visualization comparing monthly volume throughput against net realized revenue.
- **Engine Telemetry Panel**: Core gateway latency (42ms), system uptime SLA (99.99%), daily API invocation volume, and server cluster designation.
- **Live Settlement Activity Feed**: Real-time transaction stream with status badges, payment channels (Wire, Card, SEPA, Crypto), and modal inspection.
- **Instant Settlement Vault**: Modal workflow to trigger liquidity transfers via FedNow / Instant RTP.

---

### 3.3 Product Engine Architecture (`/products/:id`)
Platform engineering view for configuring gateway routing, SLAs, and developer credentials:
- **Product Overview & SLA Badges**: Active merchant deployments, monthly throughput, and SLA tiering.
- **Core Engine Capabilities**: Smart routing, failover mechanisms, PCI-DSS Level 1 token vault, and AI-driven fraud detection.
- **Developer API & Webhooks**: Public key inspection, restricted secret key rollover, and live webhook listener registration.
- **Commercial Pricing Structure**: Interchange fees, monthly platform tiers, and settlement time horizons.

---

### 3.4 User Activity & Audit Trail (`/activity` & `/user-activity`)
Full implementation of the **User Activity & Audit Trail Module (BRD v1.0)** for the Toll Ops Platform:
- **Telemetry & 8 KPI Cards (`UAM-FR-001`)**: Real-time cards for Total Users, Active/Logged-in Users, Inactive Users, Locked/Disabled Users, Failed Login Attempts (today), Total Activities Today, Critical Security Events, and Exports Performed.
- **Login Activity Trend Chart (`UAM-FR-002`)**: Chart.js line chart comparing successful vs failed authentications with interactive 7 / 14 / 30-day range toggles.
- **Module-Wise Activity Breakdown (`UAM-FR-003`)**: Proportional bar breakdown of today's logged administrative and operational actions by module.
- **Recent Activity Feed (`UAM-FR-004`)**: Real-time event feed with instant inspection and one-click navigation to the complete ledger.
- **Active Sessions Telemetry (`UAM-FR-005` to `UAM-FR-007`)**:
  - Live session list showing User, Role, Department, Network & IP, Device, Connected Since, Last Activity, Duration, and Status.
  - Search by user, department, IP, or device, and role filter dropdown with Reset Filters button.
  - Role-gated Force Logout action requiring modal confirmation with reason selection, immediate session removal, and automatic logging of the revocation event into the audit trail.
- **Authentication History (`UAM-FR-008` & `UAM-FR-009`)**:
  - Historical log displaying Last Login, Identity & Role, Login Count, Failed Login Count, Last Logout, Last IP & Geolocation, Device, Account Status badge (*Active*, *Locked*, *Suspended*), and Attempt Result.
  - Search box, status filter (*All*, *Success*, *Failed*), and date filter (*All Time*, *Today*, *Past 7 Days*, *Past 30 Days*).
- **Consolidated Audit Ledger (`UAM-FR-010` to `UAM-FR-014`)**:
  - Comprehensive table with Event ID, Timestamp, Actor Identity, Action Performed, Module, Reference ID, Correlation ID, IP Address, Outcome, and Inspect action.
  - Reference resolution (`src/utils/auditReference.js`) mapping each action to its specific canonical identifier (FASTag ID for pass actions, Transaction ID for disputes, Recon Batch ID for recon, User ID for account actions, Session ID for login/logout).
  - Global search across actor, action, Correlation ID, and Reference ID.
  - Combined filter bar: Module, Action, Status, Date Range, with an instant **Reset Filters** button.
  - Standard pagination (12 entries/page) with page jump controls.
  - Excel/CSV export (`UAM-FR-014`) with modal summary showing matching record count and applied filters before downloading, and the export itself logged into the audit ledger.
- **Audit Detail Drawer (`UAM-FR-015` & `UAM-FR-016`)**:
  - Slide-out drawer displaying prominent Target Entity Reference card, Execution Context (Actor, Correlation ID, IP, Client Device, Module, Plaza Scope), remarks, and before/after state changes diff table (`src/utils/auditDiff.js`).
  - Fallback display of *"Not captured"* rather than blank when fields are unrecorded.
  - Masking of sensitive secrets, tokens, and session references (`SES-***102`).
- **Sidebar & Routing Access (`UAM-FR-017`)**:
  - Accessible both as **`User Management → E. User Activity`** and as a standalone top-level **`User Activity & Audit`** navigation item.

---

## 4. Technology Stack & Specifications

| Component | Technology | Version / Spec |
|---|---|---|
| **Core Framework** | React | `^19.2.8` |
| **Build Tooling & HMR** | Vite | `^8.3.0` |
| **Routing Engine** | React Router DOM | `^7.x` |
| **Styling Preprocessor** | Dart Sass (SCSS) | `modern-compiler` API |
| **HTTP Client** | Axios | `^1.x` |
| **Linting & Code Quality** | Oxlint | `^1.81.0` |
| **Typography** | Google Fonts | *Manrope* (headings) & *Plus Jakarta Sans* (body) |
| **Icons** | Embedded SVG Vectors | Crisp 24x24 and 16x16 stroke-based SVGs |

---

## 5. Complete File & Directory Taxonomy

```
paysonic-dashboard/
├── .gitignore
├── .oxlintrc.json
├── index.html                       # HTML entry point with title and root div
├── package.json                     # Project manifest and scripts
├── vite.config.js                   # Vite config with Sass modern compiler and process.env define
├── README.md                        # Quickstart documentation
├── PROJECT_DOCUMENTATION.md         # Comprehensive architectural specification
│
├── server/                          # Standalone Node/Express REST API Backend
│   ├── index.js                     # Express app, CORS, error handling, port 5000
│   ├── db.js                        # Data store initialized from contracts
│   ├── middleware/
│   │   └── auditInterceptor.js      # Correlation ID injection, secret stripping, audit logger
│   └── routes/
│       ├── users.js                 # User CRUD, maker-checker, lock toggle, bulk upload
│       ├── activity.js              # 8 KPIs, trend chart, sessions, force-logout, export
│       ├── dashboard.js             # Financial analytics overview & payouts
│       └── products.js              # Gateway engine routing & API credentials
│
└── src/
    ├── index.js                     # React 19 root bootstrap importing main.scss
    ├── App.jsx                      # App shell rendering Sidebar, Topbar, and AppRoutes
    │
    ├── assets/
    │   └── styles/
    │       ├── _variables.scss      # Theme tokens ($brand-blue, $brand-green, $sidebar, fonts, spacing)
    │       ├── common.scss          # Global reusable classes (.btn, .card, .badge, .table-wrapper)
    │       └── main.scss            # Root reset, typography, and CSS custom properties
    │
    ├── components/                  # Truly shared reusable components
    │   ├── Button/                  # Button primitive with variants (primary, secondary, outline, danger)
    │   │   ├── Button.jsx
    │   │   └── Button.scss
    │   ├── Modal/                   # Accessible dialog overlay
    │   │   ├── Modal.jsx
    │   │   └── Modal.scss
    │   ├── Loader/                  # Loading spinner with full-screen mode
    │   │   ├── Loader.jsx
    │   │   └── Loader.scss
    │   ├── Sidebar/                 # Persistent dark sidebar (#0F172A) with logo & navigation
    │   │   ├── Sidebar.jsx
    │   │   └── Sidebar.scss
    │   ├── Topbar/                  # Header bar with breadcrumbs, search, and notification icon
    │   │   ├── Topbar.jsx
    │   │   └── Topbar.scss
    │   └── index.js                 # Barrel exports for shared components
    │
    ├── data/                        # Living mock JSON contracts
    │   ├── home.json                # Summary metrics, charts, and transaction feeds
    │   ├── userList.json            # 6 initial plaza and admin user profiles
    │   ├── productDetail.json       # Gateway engine specifications and API configuration
    │   ├── auditLog.json            # 150+ immutable audit events with Correlation IDs and Reference IDs
    │   ├── activeUsers.json         # Real-time authenticated session telemetry
    │   └── loginHistory.json        # Historical per-user authentication and failure logs
    │
    ├── services/                    # Domain service abstraction layer
    │   ├── api/
    │   │   └── httpClient.js        # Axios instance with auth interceptors and timeout
    │   ├── config/
    │   │   └── env.js               # Exports IS_DEV_MODE (process.env.REACT_APP_MODE === 'dev')
    │   ├── home/
    │   │   └── HomeService.js       # Home analytics data provider
    │   ├── user/
    │   │   └── UserService.js       # User CRUD, lock/unlock, and approval provider
    │   ├── userActivity/
    │   │   └── UserActivityService.js # Dashboard stats, audit queries, session force-logout, export
    │   └── product/
    │       └── ProductService.js    # Product engine configuration provider
    │
    ├── pages/                       # Feature page modules
    │   ├── Home/
    │   │   ├── Home.jsx             # Financial dashboard view
    │   │   ├── Home.scss
    │   │   └── components/
    │   │       ├── MetricCard.jsx
    │   │       ├── RevenueChart.jsx
    │   │       └── TransactionTable.jsx
    │   ├── UserList/
    │   │   ├── UserList.jsx         # Full-featured User Management view
    │   │   ├── UserList.scss        # Scoped layout styles, table rules, and modal dialogs
    │   │   ├── menuConfig.js        # 10-module permission matrix and role defaults
    │   │   └── components/
    │   │       ├── UserFilter.jsx
    │   │       └── UserTable.jsx
    │   ├── UserActivity/
    │   │   ├── UserActivity.jsx     # Consolidated 4-tab activity & audit view
    │   │   ├── UserActivity.scss
    │   │   └── components/
    │   │       ├── KpiGrid.jsx      # 8 exact BRD KPI cards
    │   │       ├── LoginTrendChart.jsx # Chart.js 7/14/30 day line chart
    │   │       ├── ModuleBreakdown.jsx # % bar list by module
    │   │       ├── RecentActivityTable.jsx # Live event feed
    │   │       ├── ActiveUsersTable.jsx # Active sessions + ForceLogoutModal
    │   │       ├── LoginHistoryTable.jsx # Historical authentication logs
    │   │       ├── AuditLogTable.jsx # Audit table with multi-filters & pagination
    │   │       ├── AuditDetailDrawer.jsx # Slide-out inspector with delta diff & masking
    │   │       └── ExportConfirmModal.jsx # CSV/JSON export with count & filter confirmation
    │   └── ProductDetail/
    │       ├── ProductDetail.jsx    # Gateway product view
    │       ├── ProductDetail.scss
    │       └── components/
    │           ├── ApiKeysSection.jsx
    │           └── ProductOverview.jsx
    │
    ├── hooks/
    │   ├── useFetch.js              # Generic async data fetching hook
    │   └── index.js
    ├── utils/
    │   ├── formatters.js            # Currency ($), date, and number formatters
    │   ├── auditReference.js        # Canonical reference resolution per module entity
    │   ├── auditDiff.js             # State change delta generator (before/after)
    │   └── index.js
    └── routes/
        └── AppRoutes.jsx            # Router switch definition (/ -> Home, /users -> UserList, /activity -> UserActivity, /products/:id)
```

---

## 6. Developer Workflow & Run Instructions

### Prerequisites
- Node.js `18.0.0` or higher
- npm `9.x` or higher

### Starting the Backend REST API Server
```bash
npm run server
```
*Launches the Express API server on `http://localhost:5000`.*
*Health Check: `http://localhost:5000/api/health`*

### Starting the Frontend Development Server
```bash
npm run dev
```
*Access the local instance at `http://localhost:5173/`.*

### Running Frontend against Live Backend
```powershell
$env:REACT_APP_MODE="prod"
$env:REACT_APP_API_BASE_URL="http://localhost:5000"
npm run dev
```

### Production Build & Validation
```bash
npm run build
```
*Generates an optimized, minified bundle in `dist/` with zero Sass or bundling warnings.*

---

## 7. Security & Compliance Considerations
- **Credential Masking**: Secret keys are never rendered in cleartext; partial masking with explicit authorization for key rotation.
- **Role Isolation**: Sub-operator roles (e.g. `Plaza POS`, `Bank`) are strictly bounded by their permission sets.
- **CSRF & Token Storage**: Request interceptors dynamically read tokens from `localStorage` (`Bearer ${token}`) with automatic fallback.
- **Input Sanitization**: Password complexity validation (1 uppercase, 1 numeric, 1 special character, 8+ characters) enforced on user creation.
