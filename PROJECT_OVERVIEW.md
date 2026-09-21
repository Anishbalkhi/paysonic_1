# 🌟 Paysonic Toll Ops & Fintech Platform — Project Specification

> **Live Production Deployments:**  
> 🌐 **Frontend (Vercel):** [https://paysonic-1.vercel.app](https://paysonic-1.vercel.app)  
> ⚙️ **Backend API (Railway):** [https://paysonic1-production.up.railway.app](https://paysonic1-production.up.railway.app)  
> 📦 **Version:** 1.0.0-enterprise  
> 🛡️ **Compliance:** ISO-20022 ready, statutory audit logging, RBAC access matrix  

---

## 1. Executive Summary

**Paysonic Toll Ops Platform** is an enterprise-grade financial technology and electronic toll collection (ETC) operations system. It bridges the gap between road transport infrastructure (FASTag, RFID toll lanes, and plaza POS terminals) and institutional banking reconciliation (reconciliation clearing, settlement cycles, dispute workflows, and transaction dispute management).

The system solves three primary enterprise challenges:
1. **Unified Identity & Access Governance:** Enforces strict role-based access control (RBAC) across 7 hierarchy levels ranging from Master Admins down to lane POS operators.
2. **Statutory Audit Trail & Compliance:** Tracks every state change, lock/unlock toggle, session termination, and administrative action with correlation IDs and actor tracking.
3. **Dual-Mode Architectural Agility:** Runs completely offline with mock JSON contracts for rapid UI prototyping, or connects seamlessly to a high-throughput Java 21 / Spring Boot backend in production.

---

## 2. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Presentation Layer                            │
│                     React 19 + Vite 8 (Vercel CDN)                     │
│  - Financial Overview (/)          - User Directory (/users)           │
│  - User Activity & Audit (/activity) - 12 Module Nav Hierarchy         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Axios Domain Services)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        API Transport Layer                             │
│  - Interceptors: X-Correlation-ID, X-Actor-ID, Bearer Auth             │
│  - Dynamic Base URL (VITE_API_BASE_URL)                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (HTTPS REST API / Whitelisted CORS)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Enterprise Backend Layer                           │
│                   Spring Boot 3.3.4 on Java 21                         │
│  - Spring Security 6 (Stateless, Permissive CORS for Vercel/Railway)   │
│  - Aspect-Oriented Auditing (@Auditable Aspect)                        │
│  - REST Controllers: /api/dashboard, /api/users, /api/activity         │
│  - JPA / Hibernate 6 ORM Layer                                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ├── Profile: h2    ──► [ In-Memory RAM Database ]
                                    └── Profile: mysql ──► [ Persistent MySQL 8.0  ]
```

---

## 3. Technology Stack Breakdown

### 🎨 Frontend
* **Core Framework:** React 19 (`^19.2.8`) + React DOM 19
* **Build Engine & Bundler:** Vite 8 (`^8.3.0`) with Rolldown runtime (sub-second builds)
* **Routing:** React Router v7 (`^7.18.4`) with client-side SPA routing and deep-linking support
* **Styling Architecture:** Vanilla SCSS with a custom Design System:
  - 8pt grid spacing system
  - HSL-tailored neutral & semantic color palettes
  - CSS custom properties (variables) for theme consistency
  - Fully responsive mobile drawers & tablet table scroll wrappers
* **Data Visualization:** Chart.js 4 (`^4.5.1`) + React-Chartjs-2
* **Icons:** Lucide React icons

### ⚙️ Backend
* **Runtime:** Java 21 (LTS) on Eclipse Temurin alpine distribution
* **Framework:** Spring Boot 3.3.4
* **Web & REST:** Spring Web MVC with Jackson JSON serialization
* **Security:** Spring Security 6 (Stateless session configuration, CSRF disabled for APIs, custom origin regex matching)
* **Aspect-Oriented Programming (AOP):** Spring AOP for non-intrusive audit logging
* **Database & ORM:** Spring Data JPA with Hibernate 6
* **Database Drivers:**
  - H2 Database (for instant cloud sandbox & zero-config startup)
  - MySQL Connector/J (for relational persistence)
* **Build Tool:** Apache Maven 3.9.9 (configured with multi-stage Docker build)

---

## 4. Key Functional Modules

### 1. Financial Telemetry & Dashboard (`/`)
* **KPI Metrics:** Total processed volume, monthly transaction counts, active merchants, and success authorization rates.
* **Volume vs. Revenue Trends:** Interactive monthly analytics chart toggling between gross transaction volume and realized revenue.
* **Live Settlement Feed:** Real-time table displaying transaction IDs, customer accounts, payment methods (Wire, Cards, USDC, RTP), timestamps, and settlement status.
* **Instant Payout Modal:** Escrow vault liquidity transfer workflow via FedNow / Instant RTP.

### 2. User Management Directory (`/users`)
* **7-Tier Persona Hierarchy:**
  1. `Master Admin`: Unrestricted system access
  2. `Admin`: Operations and reporting oversight
  3. `Plaza Admin`: Single toll plaza supervisory controls
  4. `Concessionaire`: Multi-plaza concession network management
  5. `Plaza POS`: Lane-level point-of-sale operator
  6. `Bank`: Clearing and settlement reconciliation
  7. `Request Tag Details`: RFID/FASTag search authority
* **Lifecycle Controls:**
  - Dynamic user creation with auto-incrementing IDs (`PSN1000+`)
  - Instant account lock/unlock switch
  - Managerial approval workflows (`Pending` ➔ `Approved`)
  - Auto-scrolling form validation with complex password policy enforcement

### 3. User Activity & Statutory Audit Trail (`/activity`)
* **Live Telemetry:** Active operator sessions, failed login counts, and daily activity counter.
* **Audit Trail Log:** 150+ immutable audit records detailing actor, action, timestamp, IP, and affected module.
* **Active Sessions Management:** Real-time session monitoring with remote session termination capability.
* **Authentication Log:** History of successful and blocked logins with device user-agents.

---

## 5. Security, Auditing & Networking

1. **Strict Origin CORS:**
   Whitelists development (`localhost`) and production frontends (`https://paysonic-1.vercel.app`) while accepting credentialed HTTPS requests.
2. **Distributed Correlation Tracking:**
   Every API request generates an `X-Correlation-ID` header, passed down through the Spring Boot pipeline for distributed tracing.
3. **Actor Identification:**
   Requests carry an `X-Actor-ID` header (e.g. `PSN0005`), automatically linked to audit events via the `@Auditable` AOP aspect.
4. **Resilient Containerization:**
   Multi-stage Dockerfile builds the JAR within an isolated Maven stage and copies the artifact to a minimal Alpine JRE, running with memory caps (`-XX:MaxRAMPercentage=75.0`).

---

## 6. Live Verification Endpoints

| Endpoint | Method | Function |
| :--- | :--- | :--- |
| `/api/dashboard` | `GET` | Aggregated revenue KPIs & recent transaction records |
| `/api/users` | `GET` | Complete enterprise directory |
| `/api/users` | `POST` | Create a new user with plaza assignment |
| `/api/users/{id}/lock` | `PATCH` | Toggle lock/unlock state |
| `/api/users/{id}/approve`| `PATCH` | Approve pending operator registration |
| `/api/activity/stats` | `GET` | System session & telemetry statistics |
| `/api/activity/audit-log` | `GET` | Filterable audit log events |
| `/api/activity/active-users` | `GET` | Active operator session list |
| `/api/activity/login-history`| `GET` | Security login log |
