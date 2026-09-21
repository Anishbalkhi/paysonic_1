# Paysonic Toll Ops Platform — Enterprise Java & MySQL Backend

Enterprise REST API backend for the Paysonic Toll Ops Platform built with **Spring Boot 3.3.4**, **Java 21/25**, **Spring Data JPA**, **Spring Security**, and **MySQL 8.x**.

---

## 🏛️ Architecture & Modules Covered

1. **User Management Module (Functional Spec v1.1)**
   - **Consolidated User CRUD & Status Engine**: Create, update, view, lock/unlock, and approve user accounts.
   - **Maker-Checker Enforcement**: An administrator who creates an account (`createdBy`) is strictly blocked from approving (`approveUser`) that same account.
   - **Role-Based Plaza Scoping**:
     - `Master Admin` / `Admin`: Auto-assigned to all plazas.
     - `Bank`: No plaza required / assigned.
     - `Concessionaire`: Multi-plaza selection supported.
     - `Toll Plaza` / `EV` / `Parking` / `Fuel` / `Other`: Single plaza assignment.
   - **All-or-Nothing Bulk CSV Onboarding**: Transactional rollback if any row in a CSV file fails validation.

2. **User Activity & Audit Trail Module (BRD v1.0)**
   - **8 KPI Cards (`UAM-FR-001`)**: Live counts of total users, active users, inactive, locked, failed logins, total activities, critical events, and exports.
   - **Login Trend Analytics (`UAM-FR-002`)**: 7, 14, and 30-day login trend dataset.
   - **Module Breakdown (`UAM-FR-003`)**: Real-time percentage distribution across modules.
   - **Live Active Sessions (`UAM-FR-005`)**: List and status of ongoing sessions.
   - **Force Logout with Audit Trail (`UAM-FR-007`)**: Immediate termination of active sessions with automated event generation.
   - **Authentication History (`UAM-FR-008, UAM-FR-009`)**: Full login attempt history with failure reasons and IP logging.
   - **Enterprise Audit Ledger (`UAM-FR-010 to UAM-FR-016`)**: Multi-column search, before/after JSON diffs, correlation IDs, and actor IP tracking.
   - **Compliance CSV/JSON Export (`UAM-FR-014`)**: One-click download with automatic self-audit event recording.

3. **Cross-Cutting Enterprise Features**
   - **AOP `@Auditable` Aspect**: Automated audit trail generation capturing `X-Correlation-ID` and `X-Actor-ID` headers.
   - **Sensitive Data Masking**: Utility automatically redacts passwords, tokens, and secret keys before persisting audit snapshots.
   - **CORS Configured for React**: Seamlessly connects to Vite frontend on `http://localhost:5173`.

---

## 🚀 How to Run the Backend

### Prerequisites
- **Java 21+** (Java 25 LTS is already installed on your system)
- **MySQL Server 8.x** running locally on port 3306 (or configure connection string in `src/main/resources/application.yml`).

### Option 1: Running with MySQL (Default)
1. Ensure your local MySQL server is running.
2. The database `paysonic_tollops` will be created automatically if it doesn't already exist.
3. If your MySQL root password is not `root`, set the environment variable or update `application.yml`:
   ```bash
   set SPRING_DATASOURCE_PASSWORD=your_mysql_password
   ```
4. Run the application:
   ```bash
   mvn spring-boot:run
   ```
   *Or with profile override:*
   ```bash
   mvn spring-boot:run -Dspring-boot.run.profiles=mysql
   ```

### Option 2: Running with In-Memory H2 (Zero-Setup Development)
If MySQL is not currently running and you want instant offline local development with zero external database setup:
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=h2
```

---

## 📡 REST API Endpoints

### User Management (`/api/users`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List all users with plaza arrays |
| `GET` | `/api/users/{id}` | Get user details by ID |
| `POST` | `/api/users` | Create user (role-based plaza rules applied) |
| `PUT` | `/api/users/{id}` | Update user details |
| `DELETE` | `/api/users/{id}` | Delete user profile |
| `PATCH` | `/api/users/{id}/lock` | Toggle lock / unlock status |
| `PATCH` | `/api/users/{id}/approve` | Approve user (Maker-Checker enforced) |
| `POST` | `/api/users/bulk-upload` | All-or-nothing CSV user onboarding |

### User Activity & Audit Trail (`/api/activity`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/activity/stats` | 8 KPI statistics (UAM-FR-001) |
| `GET` | `/api/activity/login-trend?days=7` | Chart.js trend dataset (7/14/30d) |
| `GET` | `/api/activity/module-breakdown` | Module percentage breakdown |
| `GET` | `/api/activity/recent?limit=10` | Recent activity feed |
| `GET` | `/api/activity/active-users` | Live active sessions list |
| `POST` | `/api/activity/sessions/{sessionId}/terminate` | Force-logout session + audit log |
| `GET` | `/api/activity/login-history` | Authentication history list |
| `GET` | `/api/activity/audit-log` | Multi-criteria audit ledger query |
| `GET` | `/api/activity/export?format=csv` | Compliance CSV / JSON export |

### Dashboard & Products (`/api/dashboard`, `/api/products`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dashboard` | Executive home summary & revenue charts |
| `GET` | `/api/products/{id}` | Product detail specifications |
