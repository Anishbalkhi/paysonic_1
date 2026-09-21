# 🏛️ Paysonic Fintech & Toll Ops Platform — System Documentation

> **Live Deployments:**  
> 🌐 **Frontend (Vercel):** [https://paysonic-1.vercel.app](https://paysonic-1.vercel.app)  
> ⚙️ **Backend API (Railway):** [https://paysonic1-production.up.railway.app](https://paysonic1-production.up.railway.app)  
> 📦 **Version:** `1.0.0-enterprise`  
> 📅 **Last Updated:** September 2026  

---

## 1. Complete Technology Stack

### 🎨 Frontend Layer (Client-Side)
* **Core Framework:** React 19 (`^19.2.8`) + React DOM 19
* **Build Engine & Bundler:** Vite 8 (`^8.3.0`) with Rolldown compiler runtime (sub-second builds & HMR)
* **Client-Side Routing:** React Router v7 (`^7.18.4`) with deep-linking & SPA fallback rewrites
* **Data Visualization:** Chart.js 4 (`^4.5.1`) with `react-chartjs-2` (`^5.3.1`)
* **Icons:** Lucide React (`^1.47.0`)
* **Styling Architecture:** Vanilla SCSS (`^1.104.1`)
  - Strict 8pt grid system
  - HSL-tailored neutral & semantic color palettes
  - CSS custom properties (variables) for theme consistency
  - Fully responsive mobile drawers & tablet table scroll wrappers
* **HTTP Transport:** Axios (`^1.20.0`) with global request & response interceptors
* **Code Quality & Linter:** Oxlint (`^1.81.0`) (high-speed Rust-based linter)

### ⚙️ Backend Layer (Server-Side)
* **Language & Runtime:** Java 21 (LTS) on Eclipse Temurin Alpine Linux
* **Core Framework:** Spring Boot 3.3.4
* **Web Layer:** Spring Web MVC with Jackson JSON serialization (JavaTime module enabled)
* **Security & CORS:** Spring Security 6.3.3 (Stateless sessions, CSRF disabled for APIs, wildcard domain whitelist)
* **Statutory Auditing:** Spring AOP 3.3.4 (`@Auditable` annotation capturing actor, IP, timestamp, action)
* **Data Access & ORM:** Spring Data JPA with Hibernate 6.5
* **Connection Pooling:** HikariCP 5.1
* **Input Validation:** Jakarta Bean Validation 3.0 (`@NotBlank`, `@Email`, `@Valid`)
* **Build Automation:** Apache Maven 3.9.9

### 🗄️ Database Layer
* **H2 Database (In-Memory):** Engine for zero-config startup (`jdbc:h2:mem:paysonic_tollops`), pre-seeded with enterprise plaza fixtures.
* **MySQL 8.0 (Production Persistent):** Enterprise relational store with auto-updating schema DDL.

### ☁️ Cloud Infrastructure & DevOps
* **Vercel:** Global Edge CDN hosting the React SPA.
* **Railway:** Cloud PaaS container hosting the Spring Boot service via Docker.
* **Docker:** Multi-stage build (Stage 1: Maven compilation, Stage 2: Minimal Alpine JRE runtime).
* **Git & GitHub:** Monorepo at `Anishbalkhi/paysonic_1`, automated CI/CD webhooks.

---

## 2. Monorepo Folder Structure

```
paysonic-dashboard/
├── .gitignore                       # Git exclusion rules for node, target, and logs
├── PROJECT_OVERVIEW.md              # High-level enterprise summary
├── SYSTEM_ARCHITECTURE.md           # This comprehensive technical guide
├── package.json                     # Root orchestrator scripts
│
├── frontend/                        # ─── React 19 Frontend ───
│   ├── index.html                   # HTML entry point with Google Fonts & favicon
│   ├── package.json                 # Frontend dependencies (React 19, Vite 8, Axios)
│   ├── vite.config.js               # Vite build config & module preload setup
│   ├── vercel.json                  # Vercel SPA routing rewrites & security headers
│   ├── .env.development             # Local dev environment (VITE_APP_MODE=dev)
│   ├── .env.production              # Prod environment (points to Railway backend)
│   │
│   └── src/
│       ├── main.jsx                 # React root mount (StrictMode)
│       ├── App.jsx                  # Main layout container (Sidebar + Topbar + Routes)
│       │
│       ├── assets/styles/           # Design system tokens & global SCSS
│       │   ├── _variables.scss      # Color palette, spacing tokens, shadows
│       │   ├── _reset.scss          # Universal box-sizing & element normalization
│       │   └── index.scss           # Main style entry point
│       │
│       ├── components/              # Shared reusable UI primitives
│       │   ├── Button/              # Pure button component (primary, ghost, danger)
│       │   ├── Modal/               # Accessible modal overlay with backdrop
│       │   ├── Loader/              # Financial spinning ring loader
│       │   ├── Sidebar/             # 12-module collapsible navigation drawer
│       │   └── Topbar/              # Mode badge (PROD/DEV), search, profile avatar
│       │
│       ├── data/                    # Offline mock JSON contracts
│       │   ├── home.json            # Mock KPI summaries & chart datasets
│       │   ├── userList.json        # Mock enterprise users directory
│       │   ├── activeUsers.json     # Mock active operator sessions
│       │   ├── loginHistory.json    # Mock authentication logs
│       │   └── productDetail.json   # Mock merchant gateway configurations
│       │
│       ├── pages/                   # Feature Views / Routed Screens
│       │   ├── Home/                # Dashboard overview, revenue charts, live txns
│       │   ├── UserList/            # User directory, add/edit modal, lock & approve
│       │   ├── UserActivity/        # Audit trail, active sessions, login history
│       │   └── ProductDetail/       # Payment gateway product config & keys
│       │
│       ├── routes/
│       │   └── AppRoutes.jsx        # Route definitions (/ , /users, /activity)
│       │
│       └── services/                # Clean Architecture Domain Service Layer
│           ├── api/
│           │   └── httpClient.js    # Axios instance with correlation interceptors
│           ├── config/
│           │   └── env.js           # Environment mode detector (IS_DEV_MODE toggle)
│           ├── home/
│           │   └── HomeService.js   # Dashboard KPIs & liquidity payout APIs
│           ├── user/
│           │   └── UserService.js   # User CRUD, status toggling, and approvals
│           ├── userActivity/
│           │   └── UserActivityService.js # Audit logs, active sessions, telemetry
│           └── product/
│               └── ProductService.js# Gateway configuration endpoints
│
└── backend/                         # ─── Java 21 / Spring Boot Backend ───
    ├── pom.xml                      # Maven dependencies & compiler configurations
    ├── Dockerfile                   # Multi-stage Docker build specification
    ├── railway.json                 # Railway cloud deployment configuration
    ├── mvnw.cmd                     # Windows Maven wrapper
    ├── start-backend.ps1            # One-click PowerShell local start script
    │
    └── src/main/
        ├── resources/
        │   ├── application.yml      # Dual profile configs (h2 vs mysql, dynamic $PORT)
        │   ├── schema.sql           # DDL schema for manual table definitions
        │   └── data/                # Initial seed data fixtures
        │
        └── java/com/paysonic/tollops/
            ├── TollOpsApplication.java  # Main Spring Boot @SpringBootApplication entry
            │
            ├── aspect/
            │   ├── Auditable.java       # Custom annotation for audit trail tagging
            │   └── AuditAspect.java     # AOP aspect capturing request metadata
            │
            ├── config/
            │   ├── SecurityConfig.java  # CORS origin patterns, CSRF, and stateless auth
            │   └── WebConfig.java       # HTTP message formatters and MVC settings
            │
            ├── controller/          # REST Controller Layer
            │   ├── DashboardController.java # /api/dashboard metrics & chart data
            │   ├── UserController.java      # /api/users CRUD & status mutations
            │   ├── ActivityController.java  # /api/activity audit trail & sessions
            │   └── ProductController.java   # /api/products gateway parameters
            │
            ├── dto/                 # Data Transfer Objects & Requests
            │   ├── CreateUserRequest.java   # Validation payload for user creation
            │   ├── UserResponseDTO.java     # Sanitized user entity representation
            │   ├── DashboardResponseDTO.java# Dashboard aggregated telemetry
            │   └── ActivityDTO.java         # Audit log & session payload models
            │
            ├── model/               # JPA Entities
            │   ├── User.java                # USERS database table mapping
            │   ├── AuditLog.java            # AUDIT_LOGS immutable audit entity
            │   └── UserSession.java         # SESSIONS active operator tracking
            │
            ├── repository/          # Spring Data JPA Repositories
            │   ├── UserRepository.java      # DB queries for users
            │   ├── AuditLogRepository.java  # DB queries for audit trail
            │   └── UserSessionRepository.java# DB queries for active sessions
            │
            └── service/             # Business Logic Layer
                ├── UserService.java         # Plaza rules, user lifecycle, validation
                ├── DashboardService.java    # KPI aggregation and trend generation
                ├── ActivityService.java     # Audit event writer and session manager
                └── ProductService.java      # Gateway parameter service
```

---

## 3. Complete REST API Reference

All backend APIs are served under the `/api` prefix.  
**Base URL:** `https://paysonic1-production.up.railway.app`

### 3.1 Standard Request Headers
* `Content-Type: application/json`
* `Origin: https://paysonic-1.vercel.app` (or `http://localhost:*`)
* `X-Correlation-ID: CORR-XXXX-XXX` (Auto-generated unique request tracking token)
* `X-Actor-ID: PSN0005` (Identity of the initiating admin / operator)

---

### 3.2 Endpoints Summary

#### 📊 Dashboard & Financial Analytics
* **`GET /api/dashboard`**
  - **Description:** Returns aggregated financial volume, revenue, success rate, monthly chart data, and live transactions.
  - **Response Status:** `200 OK`
  - **Sample Response:**
    ```json
    {
      "summary": {
        "totalRevenue": 2845920.50,
        "revenueGrowth": 14.8,
        "transactionVolume": 94821,
        "volumeGrowth": 8.2,
        "activeUsers": 14280,
        "successRate": 99.42
      },
      "chartData": [
        { "month": "Jan", "volume": 124000, "revenue": 182000 },
        { "month": "Feb", "volume": 148000, "revenue": 210000 }
      ],
      "recentTransactions": [
        {
          "id": "TXN-88349",
          "customer": "Aura Logistics Ltd",
          "amount": 14250.00,
          "currency": "USD",
          "status": "completed",
          "method": "Wire Transfer"
        }
      ]
    }
    ```

#### 👥 User Management Directory
* **`GET /api/users`**
  - **Description:** Retrieves all enterprise users across plazas.
  - **Response Status:** `200 OK` (Array of User objects).

* **`POST /api/users`**
  - **Description:** Registers a new operator or administrator.
  - **Request Body:**
    ```json
    {
      "name": "Sachin Dhaka",
      "email": "sachin@paysonic.com",
      "mobile": "7740924875",
      "role": "Admin",
      "userType": "Toll Plaza",
      "assignedPlaza": "All plazas",
      "status": "Active"
    }
    ```
  - **Response Status:** `201 Created`

* **`PATCH /api/users/{id}/lock`**
  - **Description:** Toggles the account lock state (`locked: true/false`).
  - **Response Status:** `200 OK`

* **`PATCH /api/users/{id}/approve`**
  - **Description:** Upgrades registration status from `Pending` to `Approved`.
  - **Response Status:** `200 OK`

* **`PUT /api/users/{id}`**
  - **Description:** Updates display name, plaza assignments, contact, or module permissions.
  - **Response Status:** `200 OK`

* **`DELETE /api/users/{id}`**
  - **Description:** Deletes a user profile (system logs audit event).
  - **Response Status:** `200 OK`

#### 🛡️ User Activity & Audit Trail
* **`GET /api/activity/stats`**
  - **Description:** System activity telemetry (active operators, failed logins, total audit actions).
  - **Response Status:** `200 OK`

* **`GET /api/activity/audit-log`**
  - **Description:** Filterable list of all statutory audit events (supports `?module=`, `?action=`).
  - **Response Status:** `200 OK`

* **`GET /api/activity/active-users`**
  - **Description:** Live list of active sessions with IP address, user-agent, and assigned plaza.
  - **Response Status:** `200 OK`

* **`GET /api/activity/login-history`**
  - **Description:** Authentication history records with success/failure indicators.
  - **Response Status:** `200 OK`

* **`POST /api/activity/sessions/{sessionId}/terminate`**
  - **Description:** Forcefully revokes an operator session.
  - **Response Status:** `200 OK`

---

## 4. Deployment Architecture & Setup

```
                     GitHub (main branch)
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
   [ Vercel CDN ]                  [ Railway Cloud ]
  Build: frontend/               Build: backend/ (Dockerfile)
  Vite 8 SPA Build               Multi-stage Alpine JRE
  Port: HTTPS 443                Dynamic Port ($PORT)
  paysonic-1.vercel.app          paysonic1-production.up.railway.app
```

### 4.1 Backend Deployment (Railway)
1. **Repository Connection:** Railway is linked to repository `Anishbalkhi/paysonic_1` (Branch: `main`).
2. **Root Directory:** Set to **`backend`**.
3. **Builder Specification:** Set to **`DOCKERFILE`** using [backend/Dockerfile](file:///c:/Users/user/Desktop/paysonic%20dashboard/backend/Dockerfile):
   - **Stage 1 (`builder`):** Pulls `maven:3.9.9-eclipse-temurin-21-alpine`, caches dependencies via `pom.xml`, and compiles the application with `mvn clean package -DskipTests`.
   - **Stage 2 (`runtime`):** Pulls clean `eclipse-temurin:21-jre-alpine`, copies the built JAR, and starts the JVM with container-aware memory flags (`-XX:MaxRAMPercentage=75.0`).
4. **Environment Variables:**
   - `SPRING_PROFILES_ACTIVE` = `h2` (runs in zero-config mode)
   - `PORT` = Provided dynamically by Railway's load balancer.
5. **Networking:** Public domain generated at `paysonic1-production.up.railway.app`.

### 4.2 Frontend Deployment (Vercel)
1. **Repository Connection:** Vercel is linked to repository `Anishbalkhi/paysonic_1`.
2. **Framework Preset:** `Vite`.
3. **Root Directory:** Set to **`frontend`**.
4. **SPA Rewrite Rules ([frontend/vercel.json](file:///c:/Users/user/Desktop/paysonic%20dashboard/frontend/vercel.json)):**
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   Ensures direct navigation to `/users`, `/activity`, etc., returns the SPA index without 404 errors.
5. **Environment Variables:**
   - `VITE_APP_MODE` = `prod`
   - `VITE_API_BASE_URL` = `https://paysonic1-production.up.railway.app`
6. **Live Domain:** `https://paysonic-1.vercel.app`.
