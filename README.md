# Paysonic Toll Ops Platform

Enterprise-grade Toll Operations Dashboard built with **React 19 + Spring Boot 3.3 + MySQL 8**.

---

## Project Structure

```
paysonic-dashboard/
├── frontend/          # React 19 + Vite SPA
└── backend/           # Spring Boot 3.3.4 REST API
```

---

## Local Development

### Prerequisites
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Java 21+** — [adoptium.net](https://adoptium.net)
- **MySQL 8** (optional — H2 in-memory works without it)

### Start Frontend
```powershell
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Start Backend (H2 — no MySQL needed)
```powershell
cd backend
.\start-backend.ps1 -Profile h2
# → http://localhost:8080
```

### Start Backend (MySQL — persistent data)
```powershell
cd backend
.\start-backend.ps1 -Profile mysql
```

> The script auto-downloads Maven 3.9.9 on first run.

---

## Environment Variables

### Frontend (`frontend/.env.development`)
| Variable | Default | Description |
|---|---|---|
| `VITE_APP_MODE` | `dev` | `dev` = mock data, `prod` = live API |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Spring Boot URL |

### Backend (environment / `.env`)
| Variable | Default | Description |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `mysql` | `h2` or `mysql` |
| `SPRING_DATASOURCE_URL` | `jdbc:mysql://localhost:3306/paysonic_tollops` | MySQL JDBC URL |
| `SPRING_DATASOURCE_USERNAME` | `root` | MySQL username |
| `SPRING_DATASOURCE_PASSWORD` | `root` | MySQL password |

---

## Production Deployment

### Option 1 — Vercel + Railway (Recommended, ~15 min)

#### Backend → [Railway](https://railway.app)
1. New Project → Add **MySQL** plugin
2. New Service → GitHub Repo → Root: `backend`
3. Set env vars:
   ```
   SPRING_PROFILES_ACTIVE=mysql
   SPRING_DATASOURCE_URL=<Railway MySQL URL>
   SPRING_DATASOURCE_USERNAME=root
   SPRING_DATASOURCE_PASSWORD=<password>
   ```
4. Note your Railway URL: `https://xxx.up.railway.app`

#### Frontend → [Vercel](https://vercel.com)
1. Import GitHub repo → Root: `frontend`
2. Build: `npm run build` | Output: `dist`
3. Set env var: `VITE_API_BASE_URL=https://xxx.up.railway.app`
4. Deploy ✅

### Option 2 — VPS + Nginx (Full control)

#### Build production JAR
```powershell
cd backend
build-jar.cmd
# → target/paysonic-tollops-backend-1.0.0-enterprise.jar
```

#### Build frontend
```powershell
cd frontend
# Edit .env.production: set VITE_API_BASE_URL if using separate domains
npm run build
# → dist/
```

Upload `dist/` to Nginx, JAR to server. See `deployment_guide.md` for full Nginx + systemd config.

### Option 3 — Docker
```bash
cd backend
# Build JAR first
mvn clean package -DskipTests
# Build image
docker build -t paysonic-backend .
# Run
docker run -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=mysql \
  -e SPRING_DATASOURCE_URL=jdbc:mysql://host:3306/paysonic_tollops \
  -e SPRING_DATASOURCE_USERNAME=root \
  -e SPRING_DATASOURCE_PASSWORD=secret \
  paysonic-backend
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create user |
| PUT | `/api/users/{id}` | Update user |
| DELETE | `/api/users/{id}` | Delete user |
| GET | `/api/activity/stats` | KPI dashboard stats |
| GET | `/api/activity/audit-log` | Full audit trail |
| GET | `/api/activity/active-users` | Live sessions |
| GET | `/api/activity/login-history` | Login history |
| GET | `/api/activity/login-trend?days=7` | Login trend chart |
| GET | `/api/activity/module-breakdown` | Activity by module |
| GET | `/api/activity/export?format=csv` | Export audit log |
| GET | `/api/dashboard` | Dashboard summary |

---

## Built With

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router, Recharts, Axios |
| Backend | Spring Boot 3.3.4, Spring Data JPA, Spring Security |
| Database | MySQL 8.x / H2 (dev) |
| Build | Maven 3.9.9 (auto-downloaded), Node.js 18+ |
