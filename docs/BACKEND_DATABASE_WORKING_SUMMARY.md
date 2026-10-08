# 🏛️ Paysonic TollOps — Detailed Backend & Database Working Summary

---

## 1. Executive Summary

The **Paysonic TollOps Backend** is an enterprise-grade financial and toll plaza operations management platform. It is engineered with **Java 21 (LTS)**, **Spring Boot 3.3.4**, **Spring Data JPA (Hibernate 6.5)**, **HikariCP**, and **MySQL 8.0** (with an in-memory **H2** fallback).

The backend serves as the centralized orchestration engine for:
1. **Infrastructure Master Data**: Onboarding and configuring concessionaires, toll plazas, physical lanes, vehicle fare matrices, Central Clearing House (CCH) routing, and webhooks.
2. **Identity & Access Management (IAM)**: Managing users, roles, account locking, administrative approvals, and real-time active operator session tracking.
3. **Statutory Auditing (AOP)**: Automated, non-intrusive logging of all state mutations (`before` and `after` JSON snapshots) with actor identity and correlation tokens.
4. **Toll Reconciliation & Financial Auditing**: Full lifecycle ingestion and analytics for Toll Reconciliation (TRS), Chargebacks/Disputes, NHAI Traffic classification, and FASTag Violations.

---

## 2. End-to-End Request Lifecycle & Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend / Operator (React 19)
    participant Sec as Spring Security (Stateless & CORS)
    participant AOP as Audit Aspect (@Auditable)
    participant Ctrl as REST Controller (e.g. UserController)
    participant Svc as Business Service (e.g. UserService)
    participant Repo as Spring Data JPA Repository
    participant DB as MySQL 8 / HikariCP Pool

    Client->>Sec: HTTP Request (Headers: X-Actor-ID, X-Correlation-ID)
    Sec->>Sec: Validate Origin & Path Permissions
    Sec->>AOP: Intercept Method Execution
    AOP->>Repo: Fetch Current Entity State (Pre-mutation snapshot)
    AOP->>Ctrl: Forward to Controller
    Ctrl->>Svc: Invoke Business Logic (@Transactional)
    Svc->>Svc: Validate Business Constraints & Transform Data
    Svc->>Repo: Persist / Query Changes
    Repo->>DB: Execute SQL via HikariCP Connection
    DB-->>Repo: Return Result Sets
    Repo-->>Svc: Hydrate Entities
    Svc-->>Ctrl: Return DTO
    Ctrl-->>AOP: Return Response Body
    AOP->>Repo: Save Audit Log (Actor, IP, Before/After JSON Diffs)
    AOP-->>Client: 200 OK / 201 Created JSON Response
```

---

## 3. Database Layer Mechanics

### 3.1 Dual-Profile Connection Engine
The platform dynamically switches its database provider based on active Spring profiles (`application.yml` and `DataSourceConfig.java`):

1. **MySQL 8.0 (Production / Local Default - Profile: `mysql`)**:
   - **Connection Pool**: `HikariCP` configured with 20 maximum connections, 5 minimum idle connections, and a 20-second connection timeout.
   - **Cloud Adaptability**: `DataSourceConfig.java` automatically detects standard JDBC URLs (`jdbc:mysql://...`) or raw cloud connection strings (`mysql://user:pass@host:port/db` used by Railway / Heroku) and converts them into valid JDBC parameters.
   - **Schema Initialization**: `schema.sql` creates 19 database tables with explicit indexing on timestamps, plaza codes, tag IDs, and statuses. Hibernate's `ddl-auto: update` manages incremental schema changes.

2. **H2 In-Memory Database (Test / Zero-Config - Profile: `h2`)**:
   - Runs in MySQL compatibility mode (`jdbc:h2:mem:paysonic_tollops;MODE=MySQL`).
   - Enables the H2 Web Console at `/h2-console` for ad-hoc SQL inspection.
   - Recreates tables automatically (`ddl-auto: create-drop`).

---

### 3.2 Automated Boot Seeding (`DataLoader.java`)
On application startup, `DataLoader.java` implements Spring Boot's `CommandLineRunner`:
- It checks table counts across the primary repositories (`UserRepository`, `PlazaRepository`, `TollTransactionRepository`).
- If empty (such as on a fresh deployment or in-memory boot), it automatically populates:
  - **4 Major Concessionaires**: L&T IDPL, IRB Infrastructure, MEP Infrastructure, Adani Road Transport.
  - **4 Master Plazas**: Kherki Daula (501101), Bandra-Worli Sea Link (501102), Hosur Toll Plaza (501103), DND Flyway (501104).
  - **Lanes & Matrix Configurations**: Physical Entry/Exit lanes, vehicle class fare tables (Classes 4 to 12), webhook configurations, and CCH settlement rules.
  - **Enterprise Users**: Super Admins, Plaza Managers, Bank Auditors, and Lane Operators with predefined role matrices.
  - **Operational Fixtures**: Hundreds of realistic TRS transactions, disputes, violation records, and session history logs.

---

## 4. Core Entity Relationships & Schema Design

```mermaid
erDiagram
    CONCESSIONAIRES ||--o{ PLAZAS : owns_and_operates
    PLAZAS ||--o{ LANES : contains_lanes
    PLAZAS ||--o{ PLAZA_CALLBACKS : configures_webhooks
    PLAZAS ||--o{ PLAZA_FARES : vehicle_rates
    PLAZAS ||--o{ PLAZA_CCH : bank_clearing
    PLAZAS ||--o{ TOLL_TRANSACTIONS : records_txns
    PLAZAS ||--o{ DISPUTE_TRANSACTIONS : dispute_events
    PLAZAS ||--o{ VIOLATION_TRANSACTIONS : violation_events
    USERS ||--o{ USER_SESSIONS : active_sessions
    USERS ||--o{ LOGIN_HISTORY : login_events
    USERS ||--o{ AUDIT_LOGS : actor_trail
```

### Table Categories:
1. **Master Configuration Data**:
   - `concessionaires`: Concessionaire metadata and legal entities.
   - `plazas`: Core toll plaza records (Org ID, Agency Code, Geo Coordinates, Pricing model).
   - `lanes`: Physical lane attributes (Direction, Category, Mode).
   - `plaza_callbacks`, `plaza_fares`, `plaza_cch`: Plaza-specific JSON configurations.
2. **Identity & Compliance**:
   - `users`: Operator identity, credentials, role assignments, and menu permissions.
   - `user_sessions`: Live operator sessions with heartbeat telemetry.
   - `login_history`: Historical authentication audit entries.
   - `audit_logs`: Immutable ledger of administrative and operational mutations.
3. **Financial & Operational Reporting**:
   - `toll_transactions`: Toll Reconciliation System (TRS) master dataset.
   - `dispute_transactions`: NPCI FASTag chargebacks and dispute tracking.
   - `violation_transactions`, `violation_raw_files`, `violation_settlement_reports`, `violation_validate_reports`: Discrepancy audits between AVC (Automatic Vehicle Classifier) and MVC (Manual Vehicle Classifier) with visual evidence flags.
   - `nhai_traffic_reports`, `transaction_summary_reports`, `pass_summary_reports`: Daily summary aggregations for statutory reconciliation.

---

## 5. Cross-Cutting Systems

### 5.1 Non-Intrusive AOP Auditing
The backend implements a dedicated Aspect-Oriented Programming (AOP) auditing pipeline:
- Any method annotated with `@Auditable(module = "...", action = "...")` is automatically wrapped by `AuditTrailAspect.java`.
- `SecretFilterUtil.java` intercepts and redacts sensitive keys (`password`, `secretKey`, `token`) before persisting JSON diffs.
- Captures client IP, actor identity (`X-Actor-ID`), and correlation tracing tokens (`X-Correlation-ID`) into `audit_logs`.

### 5.2 Stateless Security & CORS
- Configured via `SecurityConfig.java` to enforce stateless sessions (`SessionCreationPolicy.STATELESS`).
- CSRF protection is disabled for REST API compatibility.
- Comprehensive CORS policy allows origins from local environments (`localhost:5173`, `localhost:3000`) and live production deployments (`paysonic-1.vercel.app`).

### 5.3 Export & Reporting Utilities
All 10 reporting modules support streaming exports:
- **Excel (.xlsx)**: Generated using Apache POI with formatted headers, auto-sized columns, and currency formatting.
- **CSV (.csv)**: High-speed plain-text comma-separated export.
- **TXT (.txt)**: Fixed-width formatted text export for clearing house and bank ingestion.
