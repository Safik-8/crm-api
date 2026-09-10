# StackDot CRM — Production Deployment Guide

This guide provides the complete end-to-end instructions to build, push, deploy, and manage StackDot CRM on your live server (`sddev@192.168.1.38`).

---

## 1. Credentials & Server Details

| Property | Value |
|---|---|
| **Host IP** | `192.168.1.38` |
| **SSH User** | `sddev` |
| **SSH Password** | `2080` |
| **Deploy Directory** | `/home/sddev/stackdot-crm` |
| **Web UI URL** | `http://192.168.1.38:5176` |
| **API URL** | `http://192.168.1.38:5000` (and proxied via `http://192.168.1.38:5176/api`) |

---

## 2. Build & Push Docker Images (From Local / CI)

### Step 2.1: Log in to GitHub Container Registry (GHCR)
Run this once on your machine:

```bash
# Create a GitHub Personal Access Token (classic) with 'write:packages' scope
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Step 2.2: Build and Tag Docker Images

> [!IMPORTANT]
> Docker repository names in GHCR **must be lowercase** (e.g. `ghcr.io/safik-8/...`).

```bash
# 1. Build API image (from repository root)
docker build -t ghcr.io/safik-8/crm-api:latest -f ./crm-api/Dockerfile ./crm-api

# 2. Build Frontend Web image (from repository root)
docker build -t ghcr.io/safik-8/crm-web:latest -f ./crm-web/Dockerfile ./crm-web
```

### Step 2.3: Push Images to GHCR

```bash
# Push both images to GitHub Container Registry
docker push ghcr.io/safik-8/crm-api:latest
docker push ghcr.io/safik-8/crm-web:latest
```

---

## 3. Server Setup (Live Server: `192.168.1.38`)

### Step 3.1: Connect to Server via SSH

```bash
ssh sddev@192.168.1.38
# Password: 2080
```

### Step 3.2: Create Project Directories

```bash
mkdir -p /home/sddev/stackdot-crm/crm-api
cd /home/sddev/stackdot-crm
```

### Step 3.3: Authenticate Docker on Server

If your repository/packages are private, log in to GHCR on the server:

```bash
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### Step 3.4: Create the Production `.env` File

Create `/home/sddev/stackdot-crm/crm-api/.env`:

```bash
nano /home/sddev/stackdot-crm/crm-api/.env
```

Paste the following configuration:

```env
# Database Connections
DATABASE_URL="postgresql://postgres:safik@localhost:5432/crm"
DIRECT_URL="postgresql://postgres:safik@localhost:5432/crm"

# JWT Configuration
JWT_ACCESS_SECRET="aa19b290035748581652b5a5917c695c38850e6b211a8ef07f4ecb7d50fda41e"
JWT_REFRESH_SECRET="37cfa04e17467e1ea3edc7a875f3b22d226a82c211dd66d38323de50971d3659"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=5000
CLIENT_URL="http://192.168.1.38:5176"

# Email Settings (SMTP - Optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_SECURE=false
SMTP_FROM='"StackDot CRM" <>'
```

> [!NOTE]
> If PostgreSQL runs on the host machine outside Docker, replace `localhost` with `host.docker.internal` or the host IP `192.168.1.38` in `DATABASE_URL` and `DIRECT_URL`.

---

## 4. Production `docker-compose.yml`

Create `/home/sddev/stackdot-crm/docker-compose.yml`:

```bash
nano /home/sddev/stackdot-crm/docker-compose.yml
```

Paste the following content:

```yaml
version: '3.8'

services:
  crm-api:
    image: ghcr.io/safik-8/crm-api:latest
    container_name: stackdot-crm-api
    restart: unless-stopped
    ports:
      - "5000:5000"
    env_file:
      - ./crm-api/.env
    environment:
      - NODE_ENV=production
      - PORT=5000
    networks:
      - stackdot-network

  crm-web:
    image: ghcr.io/safik-8/crm-web:latest
    container_name: stackdot-crm-web
    restart: unless-stopped
    ports:
      - "5176:80"
    depends_on:
      - crm-api
    networks:
      - stackdot-network

networks:
  stackdot-network:
    driver: bridge
```

---

## 5. Pull & Run on the Live Server

Execute the following commands in `/home/sddev/stackdot-crm`:

```bash
# 1. Pull the latest images from GHCR
docker compose pull

# 2. Start the containers in detached mode
docker compose up -d

# 3. Apply Prisma database migrations inside the container
docker compose exec -T crm-api npx prisma migrate deploy

# 4. (First-time setup only) Run baseline seed
docker compose exec -T crm-api npx prisma db seed
```

---

## 6. Verification & Monitoring

### Check Container Status
```bash
docker compose ps
```

### View Live Logs
```bash
# Backend API logs
docker compose logs -f crm-api

# Frontend Web logs
docker compose logs -f crm-web
```

---

## 7. Fast Update / Redeploy Command (One-Liner)

Whenever you push new images, update your server with this single command:

```bash
ssh sddev@192.168.1.38 "cd /home/sddev/stackdot-crm && docker compose pull && docker compose up -d && docker compose exec -T crm-api npx prisma migrate deploy"
```

---

## 8. Seeded Default Credentials

| Role | Email | Password |
|---|---|---|
| **Super Admin** | `superadmin@gmail.com` | `superadmin123` |
| **Company Admin** | `admin@stackdot.in` | `password123` |
| **Branch Manager** | `manager@stackdot.in` | `password123` |
| **BDE** | `bde@stackdot.in` | `password123` |
| **ISE** | `ise@stackdot.in` | `password123` |
