# MAAIF EUDR Compliance Demonstration Platform

**Ministry of Agriculture, Animal Industry and Fisheries (MAAIF)** — Uganda

A modern data platform for demonstrating EU Deforestation Regulation (EUDR) compliance, farm traceability, geospatial risk analysis, and self-service business intelligence.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Deployment Modes](#deployment-modes)
4. [Architecture](#architecture)
5. [Data Warehouse (Star Schema)](#data-warehouse-star-schema)
6. [Apache Superset BI](#apache-superset-bi)
7. [Dashboards & Maps](#dashboards--maps)
8. [Configuration Reference](#configuration-reference)
9. [REST API Reference](#rest-api-reference)
10. [Data Ingestion](#data-ingestion)
11. [Geospatial Layers](#geospatial-layers)
12. [Mobile Integration](#mobile-integration)
13. [Sample Data](#sample-data)
14. [Development](#development)
15. [Troubleshooting](#troubleshooting)
16. [Future Enhancements](#future-enhancements)

---

## Overview

This platform demonstrates a production-style data architecture for national-scale EUDR compliance:

| Layer | Technology | Role |
|-------|-----------|------|
| **OLTP** | PostgreSQL 16 | Farmers, farm plots, compliance records, ingestion |
| **OLAP** | Apache Doris 2.1 | Star-schema data warehouse for analytics |
| **BI** | Apache Superset 3.1 | Self-service dashboards and SQL Lab |
| **API** | Node.js / Express | REST APIs, ETL orchestration, auth |
| **Viz** | Highcharts | Public & management dashboards (credits disabled) |
| **GIS** | GeoJSON + Highcharts Maps | District, regional, risk, and farm-level maps |

### Key Capabilities

- Public unauthenticated analytics dashboard
- Authenticated strategic management dashboard
- Five interactive geospatial map layers
- CSV / Excel / API data ingestion pipelines
- Periodic ETL sync from PostgreSQL → Doris
- Apache Superset for advanced self-service reporting
- Configurable public/private Superset access
- REST APIs ready for mobile field applications

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ and Docker Compose v2
- 8 GB RAM recommended for full warehouse stack
- Ports: `3000` (API), `5432` (PostgreSQL), `8088` (Superset), `9030` (Doris)

### Option A — Basic Demo (fastest, ~1 min)

PostgreSQL + API only. Analytics use PostgreSQL; Doris and Superset are not started.

```bash
cd eudr-platform
docker compose up --build
```

Open **http://localhost:3000**

### Option B — Full Modern Data Warehouse (~3–5 min first run)

PostgreSQL + API + Apache Doris + Apache Superset

```bash
cd eudr-platform
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml up --build
```

| Service | URL | Login |
|---------|-----|-------|
| Landing page | http://localhost:3000 | — |
| Public analytics | http://localhost:3000/analytics/ | — |
| Management dashboard | http://localhost:3000/management/ | `admin@admin.com` / `admin` |
| Geo map gallery | http://localhost:3000/maps/ | — |
| **Apache Superset** | **http://localhost:8088** | **`admin` / `admin`** |
| API health | http://localhost:3000/api/health | — |
| Warehouse status | http://localhost:3000/api/warehouse/status | — |

### Make Superset Public on Landing Page

```bash
SUPERSET_PUBLIC_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.warehouse.yml up --build
```

Or set in `.env`:
```
SUPERSET_PUBLIC_ENABLED=true
```

---

## Deployment Modes

```
┌─────────────────────────────────────────────────────────────────┐
│  MODE 1: docker compose up                                      │
│  ┌──────────┐    ┌─────────┐                                     │
│  │ PostgreSQL│◄──│ Node API │──► Highcharts Dashboards         │
│  └──────────┘    └─────────┘                                     │
├─────────────────────────────────────────────────────────────────┤
│  MODE 2: docker compose -f docker-compose.yml                   │
│          -f docker-compose.warehouse.yml up                     │
│  ┌──────────┐    ┌─────────┐    ┌────────────┐    ┌──────────┐ │
│  │ PostgreSQL│◄──│ Node API │──►│Apache Doris│◄──│ Superset │ │
│  └──────────┘    └─────────┘    └────────────┘    └──────────┘ │
│       OLTP          ETL/API          OLAP              BI        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Data Flow

```
Field/Mobile Apps ──► REST API ──► PostgreSQL (OLTP)
                        │                │
                        │         CSV/Excel/API Ingestion
                        ▼                │
                   ETL Service ◄─────────┘
                        │
                        ▼
                 Apache Doris (OLAP Star Schema)
                        │
                        ▼
              ┌─────────┴──────────┐
              ▼                    ▼
        Highcharts Dashboards   Apache Superset
        (built-in MVP)          (self-service BI)
```

### ETL Pipeline

1. **On startup** — API waits 8s, then runs warehouse sync (if `DORIS_SYNC_ON_START=true`)
2. **Periodic** — Re-sync every 5 minutes (configurable via `WAREHOUSE_SYNC_INTERVAL_MS`)
3. **Manual** — `POST /api/warehouse/sync` (requires management auth token)

---

## Data Warehouse (Star Schema)

Apache Doris hosts a modern star-schema in database `eudr_analytics`:

### Dimension Tables

| Table | Description | Key Columns |
|-------|-------------|-------------|
| `dim_district` | Uganda districts | district_name, region, compliance_rate, risk_score, lat/lng |
| `dim_date` | Date dimension | year, month, quarter, month_name |
| `dim_commodity` | Crops | coffee, cocoa, cotton, tea |

### Fact Tables

| Table | Description | Grain |
|-------|-------------|-------|
| `fact_production` | Production volumes | date × district × commodity |
| `fact_compliance` | Compliance snapshots | date × district |
| `fact_exports` | Export volumes & values | date × destination × commodity |
| `fact_farm_geo` | Geolocated farm plots | plot-level |

### Aggregate Tables

| Table | Description |
|-------|-------------|
| `agg_regional_summary` | Pre-computed regional KPIs (Central, Eastern, Western, Northern) |

### Warehouse API

```bash
# Check warehouse health
curl http://localhost:3000/api/warehouse/status

# Trigger manual sync (auth required)
curl -X POST http://localhost:3000/api/warehouse/sync \
  -H "Authorization: Bearer <jwt_token>"
```

---

## Apache Superset BI

Superset provides self-service analytics connected directly to the Doris warehouse.

### Default Credentials

| Field | Value |
|-------|-------|
| URL | http://localhost:8088 |
| Username | `admin` |
| Password | `admin` |

### Public vs Private Access

| `SUPERSET_PUBLIC_ENABLED` | Landing Page | Management Dashboard |
|---------------------------|--------------|---------------------|
| `false` (default) | No Superset link | Superset link + credentials |
| `true` | Superset link + credentials visible | Superset link + credentials |

### Pre-registered Data Sources

- **EUDR Doris Warehouse** — analytics star schema (recommended for dashboards)
- **EUDR PostgreSQL OLTP** — live operational data

### Creating Dashboards

See the full guide: [docs/SUPERSET_GUIDE.md](docs/SUPERSET_GUIDE.md)

Quick steps:
1. Login at http://localhost:8088 (`admin` / `admin`)
2. **Data → Datasets → + Dataset** → select `dim_district` from Doris
3. **Charts → + Chart** → build visualizations
4. **Dashboards → + Dashboard** → compose your EUDR report

---

## Dashboards & Maps

### Built-in Dashboards (Highcharts)

| Dashboard | URL | Auth | Based On |
|-----------|-----|------|----------|
| Landing | `/` | None | — |
| Public Analytics | `/analytics/` | None | Sample Analytics Dashboard PDF |
| Management Strategic | `/management/` | `admin@admin.com` / `admin` | Sample Strategic Dashboard PDF |
| Geo Map Gallery | `/maps/` | None | 5 interactive map layers |

### Geo Map Gallery (`/maps/`)

| Layer ID | Name | Type | Metric Options |
|----------|------|------|----------------|
| `districts` | District Boundaries | Choropleth | compliance, risk, production |
| `regions` | Regional Overview | Choropleth | compliance by macro-region |
| `coffee-belt` | Coffee Production Belt | Choropleth | production tons |
| `risk-zones` | Deforestation Risk Zones | Heatmap | risk score |
| `farm-clusters` | Registered Farm Plots | Point map | status, risk per farm |

All layers are also available via REST API with live database enrichment.

---

## Configuration Reference

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API server port |
| `DATABASE_URL` | `postgresql://eudr:eudr_secret@...` | PostgreSQL connection |
| `DORIS_HOST` | `doris-fe` | Apache Doris FE hostname |
| `DORIS_PORT` | `9030` | Doris MySQL protocol port |
| `DORIS_DATABASE` | `eudr_analytics` | Doris warehouse database |
| `DORIS_SYNC_ON_START` | `true` | Run ETL on API startup |
| `WAREHOUSE_SYNC_INTERVAL_MS` | `300000` | Periodic ETL interval (5 min) |
| `SUPERSET_URL` | `http://localhost:8088` | Superset base URL |
| `SUPERSET_PUBLIC_ENABLED` | `false` | Show Superset on public landing page |
| `SUPERSET_ADMIN_USER` | `admin` | Superset admin username (demo) |
| `SUPERSET_ADMIN_PASSWORD` | `admin` | Superset admin password (demo) |
| `PUBLIC_USER_GUIDE_ENABLED` | `true` | Show user guide on landing/analytics |
| `PUBLIC_BASE_URL` | (empty) | External URL, e.g. `http://203.0.113.10:3000` |
| `HOST` | `0.0.0.0` | Network interface to bind (use `0.0.0.0` for remote access) |
| `JWT_SECRET` | (demo value) | JWT signing secret |

### Runtime Config API

```bash
curl http://localhost:3000/api/auth/config
```

Returns platform version, Superset settings, warehouse info, and feature flags.

---

## REST API Reference

### Authentication

```bash
# Management login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"admin"}'
```

### Core Entities (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/farmers` | List farmers (`?district=&limit=&offset=`) |
| GET | `/api/farmers/:id` | Farmer detail |
| POST | `/api/farmers` | Create farmer |
| GET | `/api/farm-plots` | List plots (`?district=&commodity=&status=`) |
| GET | `/api/farm-plots/:id` | Plot detail with compliance |
| GET | `/api/compliance` | Compliance records |
| GET | `/api/compliance/summary` | Status breakdown |

### Analytics (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/kpis` | Strategic KPI cards |
| GET | `/api/analytics/compliance-overview` | Compliant / non-compliant / pending |
| GET | `/api/analytics/compliance-trend` | Monthly trend (Doris or PostgreSQL) |
| GET | `/api/analytics/district-performance` | District matrix |
| GET | `/api/analytics/production-trends` | Monthly & annual production |
| GET | `/api/analytics/export-performance` | Destinations & exporters |
| GET | `/api/analytics/risk-heatmap` | Deforestation risk by district |
| GET | `/api/analytics/map-farms` | Geolocated farm coordinates |
| GET | `/api/analytics/custom-report` | Filtered report (`?region=&district=&crop=`) |
| GET | `/api/analytics/warehouse-status` | Data source availability |

### Geospatial (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/geo/layers` | List available map layers |
| GET | `/api/geo/layers/:id` | GeoJSON with DB-enriched properties |
| GET | `/api/geo/districts` | District list with mapped plot counts |

### Warehouse (Auth for sync)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/warehouse/status` | Warehouse health & table list |
| POST | `/api/warehouse/sync` | Trigger ETL sync (Bearer token) |

### Ingestion (Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingestion/csv` | Upload CSV (`multipart/form-data`, field: `file`) |
| POST | `/api/ingestion/excel` | Upload Excel |
| POST | `/api/ingestion/api` | JSON body with farmer records |
| GET | `/api/ingestion/logs` | Ingestion history |

---

## Data Ingestion

### CSV / Excel Format

```csv
farmer_code,name,gender,age_group,phone,district,sub_county
UG-F-1001,Mary Akello,female,36-45,+256700100001,Kabale,Rubanda
```

Sample file: [docs/sample-farmers.csv](docs/sample-farmers.csv)

### API Ingestion

```bash
TOKEN="<jwt_from_login>"
curl -X POST http://localhost:3000/api/ingestion/api \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"farmer_code":"UG-F-2001","name":"Test Farmer","district":"Mbale"}]'
```

After ingestion, trigger warehouse sync to reflect changes in Doris and Superset.

---

## Geospatial Layers

GeoJSON files live in `public/data/` and are enriched at request time with live compliance data from PostgreSQL.

```
public/data/
├── uganda-districts.geojson    # 30 district polygons
├── uganda-regions.geojson      # 4 macro-regions
├── uganda-coffee-belt.geojson  # 10 coffee-growing districts
└── uganda-risk-zones.geojson   # Risk-classified zones
```

Farm plot clusters are generated dynamically from the database (`/api/geo/layers/farm-clusters`).

### Adding Custom Layers

1. Add a `.geojson` file to `public/data/`
2. Register in `backend/src/routes/geo.js` → `LAYERS` object
3. Layer appears automatically in `/maps/` gallery and API

---

## Mobile Integration

```bash
curl http://localhost:3000/api/mobile
```

All entity endpoints return JSON with pagination. CORS is enabled. Use JWT Bearer tokens for write operations.

Recommended mobile workflow:
1. `POST /api/auth/login` → obtain token
2. `GET /api/farm-plots?district=X` → list plots
3. `POST /api/farm-plots` → register new plot with GPS coordinates
4. `POST /api/compliance` → submit compliance assessment

---

## Sample Data

Seeded automatically on first startup from the Sample Analytics and Strategic Dashboard specifications:

- **20+ districts** with compliance rates, risk scores, production
- **15 sample farm plots** with GPS coordinates across Uganda
- **5 Moroto non-compliant farms** for drill-down demonstration
- **Monthly production** (coffee & cocoa, 2025)
- **Annual production** by district (2021–2025)
- **Export destinations** (Germany, Italy, Belgium, etc.)
- **Top 5 coffee exporters** with volumes and compliance rates
- **12-month compliance trend** (65% → 85%)

---

## Server Deployment (Public IP Access)

Deploy the platform on a VPS or cloud server so users can access it via the server's public IP.

### Prerequisites

- Ubuntu/Debian Linux server with Docker 24+ and Docker Compose v2
- Firewall ports open: **3000** (platform), **8088** (Superset, optional)
- PostgreSQL stays on the internal Docker network only (not published to the host), so it will not conflict with an existing PostgreSQL on port 5432

### Manual Install

```bash
# On the server
git clone <your-repo-url> /opt/eudr-platform
cd /opt/eudr-platform

# Replace with your server's public IP or hostname
export PUBLIC_BASE_URL=http://YOUR_SERVER_IP:3000
export JWT_SECRET=$(openssl rand -hex 32)

chmod +x scripts/install.sh
./scripts/install.sh YOUR_SERVER_IP
```

Open **http://YOUR_SERVER_IP:3000** from any browser.

### Full Warehouse Stack on Server

```bash
export PUBLIC_BASE_URL=http://YOUR_SERVER_IP:3000
export ENABLE_WAREHOUSE=true
./scripts/install.sh YOUR_SERVER_IP
```

| Service | URL |
|---------|-----|
| Platform | http://YOUR_SERVER_IP:3000 |
| Superset | http://YOUR_SERVER_IP:8088 |

Superset links in the UI are generated automatically from `PUBLIC_BASE_URL`.

### Update / Redeploy

```bash
cd /opt/eudr-platform
git pull
export PUBLIC_BASE_URL=http://YOUR_SERVER_IP:3000
export JWT_SECRET=your-existing-secret
./scripts/deploy.sh YOUR_SERVER_IP
```

### GitHub Actions

Two workflows are included in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **Docker Build** | Push/PR to `main` | Builds images, validates compose, smoke-tests API |
| **Deploy** | Push to `main` or manual | SSH deploy to your server |

#### Required GitHub Secrets (for Deploy workflow)

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Server public IP or hostname |
| `SSH_USER` | SSH username (e.g. `ubuntu`) |
| `SSH_PRIVATE_KEY` | Private key for SSH access |
| `JWT_SECRET` | Production JWT signing secret |
| `DEPLOY_PATH` | (optional) Install path, default `/opt/eudr-platform` |
| `SSH_PORT` | (optional) SSH port, default `22` |
| `ENABLE_WAREHOUSE` | (optional) `true` to deploy Doris + Superset |

#### First-time server setup for GitHub Actions

```bash
# On the server — one-time bootstrap
sudo mkdir -p /opt/eudr-platform
sudo chown $USER:$USER /opt/eudr-platform
git clone <your-repo-url> /opt/eudr-platform
cd /opt/eudr-platform
export PUBLIC_BASE_URL=http://YOUR_SERVER_IP:3000
./scripts/install.sh YOUR_SERVER_IP
```

After secrets are configured, pushes to `main` automatically run `./scripts/deploy.sh`.

### Nginx reverse proxy (port 8003 → app)

If your server maps **external port 8003** to **internal port 80**, nginx must proxy to the Docker API on port 3000. The default nginx welcome page means nginx is running but not configured yet.

```bash
cd /opt/eudr-platform
git pull
chmod +x scripts/setup-nginx.sh
sudo ./scripts/setup-nginx.sh

export PUBLIC_BASE_URL=http://YOUR_SERVER_IP:8003
export JWT_SECRET=your-existing-secret
./scripts/deploy.sh YOUR_SERVER_IP
```

Verify:

```bash
curl http://127.0.0.1:3000/api/health          # Docker API (on server)
curl http://127.0.0.1/api/health               # via nginx → API
curl http://YOUR_SERVER_IP:8003/api/health     # public URL
```

Open **http://YOUR_SERVER_IP:8003** — you should see the MAAIF EUDR landing page, not the nginx welcome screen.

---

## Development

### Local (without Docker)

```bash
# Requires local PostgreSQL
cd backend
cp ../.env.example .env
npm install
npm run migrate
npm run seed
npm start
```

### Project Structure

```
eudr-platform/
├── docker-compose.yml              # Base: PostgreSQL + API
├── docker-compose.warehouse.yml    # Overlay: Doris + Superset
├── docker-compose.prod.yml         # Production: bind API to 0.0.0.0
├── docker-compose.prod.warehouse.yml
├── deploy/nginx/
│   └── eudr-platform.conf        # Reverse proxy for port 80 → :3000
├── scripts/
│   ├── install.sh                  # First-time server install
│   ├── deploy.sh                   # Update/redeploy on server
│   └── setup-nginx.sh              # Configure nginx reverse proxy
├── .github/workflows/
│   ├── docker-build.yml            # CI: build & smoke test
│   └── deploy.yml                  # CD: SSH deploy to server
├── backend/
│   ├── src/
│   │   ├── config/                 # Environment configuration
│   │   ├── db/                     # PostgreSQL & Doris clients
│   │   ├── routes/                 # REST API routes
│   │   ├── services/warehouse.js   # Star-schema ETL
│   │   └── scripts/                # Migrations, seed, sync
│   └── Dockerfile
├── superset/                       # Superset Docker image & init
├── public/                         # Frontend dashboards
│   ├── analytics/                  # Public dashboard
│   ├── management/                 # Strategic dashboard
│   ├── maps/                       # Geo map gallery
│   ├── data/                       # GeoJSON layers
│   └── js/                         # Highcharts logic
└── docs/
    ├── SUPERSET_GUIDE.md
    ├── FUTURE_ENHANCEMENTS.md
    └── sample-farmers.csv
```

### NPM Scripts

```bash
npm run migrate      # Run database migrations
npm run seed         # Seed demonstration data
npm run sync-doris   # Manual warehouse ETL sync
npm start            # Start API server
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| API won't start | Check `docker compose logs api`; ensure PostgreSQL is healthy |
| Doris unavailable | Use full stack: `-f docker-compose.warehouse.yml`; wait 3–5 min |
| Superset blank page | Wait for init; check `docker compose logs superset` |
| Empty Superset datasets | Run `POST /api/warehouse/sync` after Doris is up |
| Maps not loading | Ensure API is running; check `/api/geo/layers` |
| npm install fails locally | Use Docker mode instead |
| Port 3000 in use | Change `PORT` in `.env` |

### Useful Commands

```bash
# View all service logs
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml logs -f

# Restart just the API
docker compose restart api

# Reset all data
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml down -v
```

---

## Future Enhancements

See [docs/FUTURE_ENHANCEMENTS.md](docs/FUTURE_ENHANCEMENTS.md) for the full roadmap including:

- Kohtas EUDR API integration
- PostGIS advanced GIS capabilities
- Automated deforestation risk scoring
- EU Due Diligence Statement (DDS) generation
- Full Uganda district GeoJSON (146 districts)
- OAuth2 / government SSO
- Offline mobile field sync

---

## License

Demonstration platform for MAAIF evaluation purposes.

**Ministry of Agriculture, Animal Industry and Fisheries (MAAIF)** — Republic of Uganda
