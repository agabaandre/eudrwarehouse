# MAAIF EUDR Compliance Demonstration Platform

**Ministry of Agriculture, Animal Industry and Fisheries (MAAIF)** — Uganda

A modern data platform for demonstrating EU Deforestation Regulation (EUDR) compliance, farm traceability, geospatial risk analysis, and self-service business intelligence.

---

## Table of Contents

1. [Overview](#overview)
2. [Modern Frontend](#modern-frontend)
3. [SEO & Crawler Protection](#seo--crawler-protection)
4. [Performance & Scaling](#performance--scaling)
5. [Quick Start](#quick-start)
6. [Deployment Modes](#deployment-modes)
7. [Architecture](#architecture)
8. [Data Warehouse (Star Schema)](#data-warehouse-star-schema)
9. [Apache Superset BI](#apache-superset-bi)
10. [Dashboards & Maps](#dashboards--maps)
11. [Configuration Reference](#configuration-reference)
12. [REST API Reference](#rest-api-reference)
13. [Data Ingestion](#data-ingestion)
14. [Geospatial Layers](#geospatial-layers)
15. [Mobile Integration](#mobile-integration)
16. [Sample Data](#sample-data)
17. [Production Deployment & Nginx Security](#production-deployment--nginx-security)
18. [Development](#development)
19. [Troubleshooting](#troubleshooting)
20. [Future Enhancements](#future-enhancements)

---

## Overview

This platform demonstrates a production-style data architecture for national-scale EUDR compliance:

| Layer | Technology | Role |
|-------|-----------|------|
| **OLTP** | PostgreSQL 16 | Operational database for transactional workloads: farmer and exporter registration, farm plot boundaries with GPS coordinates, compliance assessments, supply-chain links, SMS alerts, training enrolments, and USSD channel records. Handles CSV/Excel ingestion writes, enforces relational integrity across districts and commodities, and serves as the system of record for all field data before warehouse sync. |
| **OLAP** | Apache Doris 2.1 | Column-oriented analytics warehouse storing a star-schema model (dimensions for farmers, districts, time; facts for production, compliance, exports). Receives periodic ETL from PostgreSQL for heavy aggregations — district rankings, trend analysis, and cross-regional reporting — without burdening the OLTP database during peak registration or ingestion loads. |
| **BI** | Apache Superset 3.1 | Self-service business intelligence layer connected to Doris and PostgreSQL. Officers build custom dashboards, run ad-hoc SQL in SQL Lab, and share compliance reports with exporters and EU auditors. Proxied at `/superset/` behind nginx so port 8088 stays internal; supports optional public or authenticated-only access. |
| **Frontend** | Vue 3 + Vite | Single-page application serving all user-facing pages: pitch landing, registration hub, public analytics, geospatial map gallery, and authenticated management dashboard. Includes 7-language i18n (English, Luganda, Swahili, and four Ugandan regional languages), per-route SEO meta tags, responsive mobile navigation, and code-split bundles for fast initial load. |
| **API** | Node.js / Express | REST API gateway and orchestration layer: JWT authentication, rate limiting, gzip compression, and connection pooling for 200+ concurrent users. Exposes registration, analytics, geo, ingestion, warehouse sync, and mobile/USSD endpoints; runs ETL jobs to Doris; serves the built Vue SPA and dynamic `robots.txt` / `sitemap.xml`. |
| **Cache** | Redis 7 | In-memory cache layer for hot read paths: analytics dashboards, GeoJSON map layers, auth config, training modules, supply-chain summaries, and district lists. Uses LRU eviction (256 MB cap) with TTL-based expiry. Shares rate-limit counters across Node cluster workers. Cache is invalidated automatically on registration, ingestion, and warehouse sync. |
| **Viz** | Highcharts Maps | Embedded charting engine for dashboards — pie, line, bar, column, area, and choropleth series on public analytics and management views. Highcharts Maps module powers interactive Uganda basemaps with farm plot point layers coloured by compliance status. Credits disabled for a clean government presentation. |
| **GIS** | GeoJSON + Highcharts Maps | Geospatial data layer delivering five map types: district boundaries, regional groupings, coffee belt polygons, deforestation risk zones, and geolocated farm plot clusters. GeoJSON served via `/api/geo/layers` with client-side rendering; supports metric switching (compliance %, risk score, production tonnes) and map navigation controls. |

### Key Capabilities

- **Modern Vue 3 frontend** — pitch-ready landing page, responsive navigation, 7-language i18n
- Public unauthenticated analytics dashboard with SEO-optimised pages
- Authenticated strategic management dashboard (blocked from search engines)
- Farmer & exporter registration hub with USSD *284#, SMS alerts, training videos
- Supply chain traceability from farm plot to export batch
- Five interactive geospatial map layers with farm plot clusters
- CSV / Excel / API data ingestion pipelines
- Periodic ETL sync from PostgreSQL → Doris
- Apache Superset BI proxied at `/superset/` (no public port 8088 required)
- REST APIs ready for mobile field applications
- Production hardening for 200+ concurrent users (pooling, rate limits, nginx)

---

## Modern Frontend

The UI is a **Vue 3 + Vite** single-page application designed as a competitive pitch product for national EUDR programmes.

### Design System

| Feature | Implementation |
|---------|----------------|
| Typography | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |
| Colour palette | MAAIF green (`#0d5c28` → `#1a7f37`), gold accent, slate neutrals |
| Layout | CSS custom properties, card-based grids, sticky glass header |
| Motion | Subtle hover lifts; `prefers-reduced-motion` respected |
| Icons | Semantic emoji icons on feature cards (zero extra dependencies) |

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Pitch landing — hero, live KPI stats, trust bar, feature grid, CTA |
| `/registration` | Multi-tab hub: supply chain, farmer/exporter forms, training, USSD, SMS |
| `/analytics` | Public Highcharts dashboards — production, compliance, risk |
| `/maps` | Five geospatial layers with district choropleths and farm clusters |
| `/management` | Auth-gated leadership dashboard (not indexed by search engines) |

### Internationalisation

Seven locales via `vue-i18n`: English, Luganda, Swahili, Runyankole, Ateso, Acholi, Lusoga. Locale persists in `localStorage`.

### Build Optimisation

- Code-split vendor bundles (`vue`, `highcharts`) for faster first paint
- Static assets cached 7 days in production
- `npm run build` outputs to `frontend/dist` → copied to `public/` for Express

---

## SEO & Crawler Protection

Public pages are optimised for discoverability; admin and API routes are explicitly blocked.

### Per-Route Meta Tags

`frontend/src/composables/useSeo.js` sets on every navigation:

- `<title>` and meta description
- Open Graph (`og:title`, `og:description`, `og:image`, `og:url`)
- Twitter Card tags
- Canonical URL
- `robots` directive per route

| Route | robots |
|-------|--------|
| `/`, `/analytics`, `/maps`, `/registration` | `index, follow` |
| `/management` | `noindex, nofollow, noarchive, nosnippet` |

### robots.txt & Sitemap

- **Static:** `frontend/public/robots.txt` — disallows `/management`, `/api/`, `/superset/`
- **Dynamic:** `GET /robots.txt` and `GET /sitemap.xml` — generated with `PUBLIC_BASE_URL` for correct absolute URLs in production

### Server-Side Protection

Express and nginx both emit `X-Robots-Tag: noindex` for:

- `/management` (SPA and all subpaths)
- `/api/*`
- `/superset/*`

### Open Graph Image

`frontend/public/og-image.svg` — branded 1200×630 share image for social previews.

---

## Performance & Scaling

Tuned for **200+ concurrent users** on a single modest server.

### Application Layer

| Setting | Default | Purpose |
|---------|---------|---------|
| `CLUSTER_WORKERS` | `2` (production) | Node.js cluster mode — multi-process API |
| `PG_POOL_MAX` | `25` | PostgreSQL connection pool per worker |
| `RATE_LIMIT_API_MAX` | `300`/min | General API rate limit per IP |
| `RATE_LIMIT_AUTH_MAX` | `20`/15min | Login brute-force protection |
| `RATE_LIMIT_INGEST_MAX` | `10`/min | Upload throttling |
| `REDIS_URL` | `redis://redis:6379` | Redis connection (Docker); disable with `REDIS_ENABLED=false` |
| `CACHE_TTL_ANALYTICS` | `120`s | Analytics API response cache |
| `CACHE_TTL_GEO` | `3600`s | GeoJSON layer cache |

```bash
# Recommended production env for 200+ concurrent users
export CLUSTER_WORKERS=4
export PG_POOL_MAX=25
export RATE_LIMIT_API_MAX=300
export REDIS_URL=redis://redis:6379
```

### Redis Caching

Redis accelerates the most-requested read endpoints and unifies rate limiting across cluster workers:

| Namespace | Endpoints | Default TTL | Invalidated on |
|-----------|-----------|-------------|----------------|
| `analytics` | `/api/analytics/*` | 120s | Ingestion, registration, warehouse sync |
| `geo` | `/api/geo/*` | 3600s | Ingestion, registration |
| `config` | `/api/auth/config` | 300s | Manual / deploy |
| `supply` | `/api/supply-chain/*` | 60s | Registration, ingestion |
| `training` | `/api/training/*` | 1800s | — |
| `registration` | `/api/registration/districts` | 3600s | — |
| `warehouse` | `/api/warehouse/status` | 30s | Warehouse sync |

Responses include an `X-Cache: HIT` or `X-Cache: MISS` header when Redis is connected. If Redis is unavailable, the API continues without caching (in-memory rate limits per worker only).

```bash
# Verify Redis in health check
curl http://localhost:3000/api/health
# → {"status":"ok","redis":"connected",...}

# Watch cache hits in response headers
curl -I http://localhost:3000/api/analytics/kpis
# X-Cache: HIT
```

### Middleware Stack

- **gzip compression** on all responses
- **Security headers** (`X-Content-Type-Options`, `Referrer-Policy`, etc.)
- **Static asset caching** — hashed JS/CSS cached 7 days; `index.html` never cached

### Database

PostgreSQL pool with configurable `max`, `idleTimeoutMillis`, and `connectionTimeoutMillis`. Analytics queries use indexed columns; warehouse offload via Doris for heavy reporting.

### Nginx (External Reverse Proxy)

See [Production Deployment & Nginx Security](#production-deployment--nginx-security) for rate limiting, connection limits, keepalive upstream, and bot blocking.

### Horizontal Scaling

For 500+ users, run multiple API containers behind nginx `upstream` with shared PostgreSQL and Redis. Rate limits and response caches are shared via Redis across all workers and replicas.

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ and Docker Compose v2
- 8 GB RAM recommended for full warehouse stack
- Ports: `3000` (API), `5432` (PostgreSQL), `6379` (Redis), `8088` (Superset), `9030` (Doris)

### Option A — Basic Demo (fastest, ~1 min)

PostgreSQL + API only. Analytics use PostgreSQL; Doris and Superset are not started.

```bash
cd eudr-platform
docker compose up --build
```

Open **http://localhost:3000** (Vue SPA — all routes served from `/`)

| Page | URL | Login |
|------|-----|-------|
| Home | http://localhost:3000/ | — |
| **Registration Hub** | http://localhost:3000/registration | — |
| Public analytics | http://localhost:3000/analytics | — |
| Management dashboard | http://localhost:3000/management | `admin@admin.com` / `admin` |
| Geo map gallery | http://localhost:3000/maps | — |
| API health | http://localhost:3000/api/health | — |

### Option B — Full Modern Data Warehouse (~3–5 min first run)

PostgreSQL + API + Apache Doris + Apache Superset

```bash
cd eudr-platform
docker compose -f docker-compose.yml -f docker-compose.warehouse.yml up --build
```

| Service | URL | Login |
|---------|-----|-------|
| Landing page | http://localhost:3000/ | — |
| Registration hub | http://localhost:3000/registration | — |
| **Apache Superset** | **http://localhost:8088** | **`admin` / `admin`** |
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
│  │ PostgreSQL│◄──│ Node API │──► Vue 3 SPA (Highcharts)        │
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

![MAAIF EUDR Data Warehouse Architecture](./data-warehouse-architecture.png)

> Vector source: [`data-warehouse-architecture.svg`](./data-warehouse-architecture.svg) · PNG: [`data-warehouse-architecture.png`](./data-warehouse-architecture.png)

### Data Flow

```
Field/Mobile Apps ──► REST API ──► PostgreSQL (OLTP)
                        │    │           │
                        │    └──► Redis (cache + rate limits)
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
        (Vue 3 SPA)             (self-service BI)
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

### Vue 3 Application Pages

| Page | URL | Auth |
|------|-----|------|
| Home | `/` | None |
| **Registration Hub** | `/registration` | None — farmers, exporters, supply chain, training, USSD, SMS |
| Public Analytics | `/analytics` | None |
| Management Strategic | `/management` | `admin@admin.com` / `admin` |
| Geo Map Gallery | `/maps` | None |

### Geo Map Gallery (`/maps`)

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
3. Layer appears automatically in `/maps` gallery and API

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

## Production Deployment & Nginx Security

When exposing the platform on a public IP (e.g. `http://41.186.86.12:8003`), use the included nginx configuration with security hardening.

### Install Nginx + Security Snippets

```bash
sudo ./scripts/setup-nginx.sh
```

This copies:

- `deploy/nginx/eudr-platform.conf` — main server block
- `deploy/nginx/snippets/eudr-security.conf` — rate limit zones, bot map, headers
- `deploy/nginx/snippets/eudr-proxy.conf` — shared proxy settings

### Nginx Security Features

| Feature | Configuration |
|---------|---------------|
| Rate limiting | 30 req/s general, 60 req/s API, 5 req/min auth login |
| Connection limit | 50 concurrent connections per IP |
| Bad bot blocking | Blocks nikto, sqlmap, nmap, empty user-agent, etc. |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` |
| Admin noindex | `X-Robots-Tag` on `/management` and `/superset/` |
| Static caching | 7-day cache for JS/CSS/images |
| Keepalive upstream | 32 persistent connections to API |
| Superset proxy | `/superset/` → `127.0.0.1:8088` (port 8088 not public) |

### Fail2ban Policies

Example jails in `deploy/fail2ban/`:

| Jail | Trigger | Ban duration |
|------|---------|--------------|
| `nginx-limit-req` | Rate limit exceeded (10 hits in 60s) | 2 hours |
| `nginx-botsearch` | Probes for `.env`, `wp-admin`, `.git` (2 hits) | 24 hours |
| `nginx-eudr-auth` | Failed `POST /api/auth/login` (8 hits in 5 min) | 1 hour |

```bash
# Install on Ubuntu/Debian
sudo apt install fail2ban

sudo cp deploy/fail2ban/nginx-*.conf /etc/fail2ban/filter.d/
sudo cp deploy/fail2ban/jail.local.example /etc/fail2ban/jail.d/eudr.local
sudo systemctl restart fail2ban

# Check banned IPs
sudo fail2ban-client status nginx-limit-req
```

### Recommended Additional Hardening

1. **TLS/HTTPS** — terminate SSL at nginx with Let's Encrypt (`certbot`)
2. **Firewall** — `ufw allow 8003/tcp` only; block direct access to ports 3000, 5432, 8088
3. **JWT_SECRET** — use a strong random value in production (`openssl rand -hex 32`)
4. **Superset** — bind to `127.0.0.1:8088` only (default in `docker-compose.prod.warehouse.yml`)
5. **Log monitoring** — ship `/var/log/nginx/access.log` to your SIEM

### Production Environment

```bash
export PUBLIC_BASE_URL=http://YOUR_SERVER_IP:8003
export SUPERSET_URL=http://YOUR_SERVER_IP:8003/superset
export ENABLE_WAREHOUSE=true
export JWT_SECRET=$(openssl rand -hex 32)
export CLUSTER_WORKERS=4
export PG_POOL_MAX=25

./scripts/deploy.sh YOUR_SERVER_IP
sudo ./scripts/setup-nginx.sh
```

---

## Development

### Frontend (Vue 3 + Vite)

The UI is a Vue 3 SPA in `frontend/`. Production builds output to `public/` and are served by Express.

**Key directories:**

```
frontend/
├── src/views/           # Page components (Home, Analytics, Maps, Registration, Management)
├── src/components/      # AppHeader (sticky nav + mobile menu), AppFooter
├── src/composables/     # api.js, highcharts.js, useSeo.js
├── src/i18n/locales/    # 7 language files
└── public/              # robots.txt, sitemap.xml, favicon, og-image, GeoJSON
```

```bash
# Terminal 1 — API
cd backend && npm install && npm start

# Terminal 2 — Vue dev server (proxies /api → :3000)
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173** for hot-reload development.

```bash
# Production build → frontend/dist (Docker copies to public/)
cd frontend && npm run build && cp -r dist/* ../public/
```

### Local API (without Docker)

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
├── docker-compose.yml              # Base: PostgreSQL + Redis + API
├── docker-compose.warehouse.yml    # Overlay: Doris + Superset
├── docker-compose.prod.yml         # Production: bind API to 0.0.0.0
├── docker-compose.prod.warehouse.yml
├── deploy/nginx/
│   ├── eudr-platform.conf          # Reverse proxy + rate limits
│   └── snippets/                   # Security zones, proxy headers
├── deploy/fail2ban/                # Bot protection jail examples
├── scripts/
│   ├── install.sh                  # First-time server install
│   ├── deploy.sh                   # Update/redeploy on server
│   └── setup-nginx.sh              # Configure nginx reverse proxy
├── .github/workflows/
│   ├── docker-build.yml            # CI: build & smoke test
│   └── deploy.yml                  # CD: SSH deploy to server
├── frontend/                       # Vue 3 SPA (Vite)
│   ├── src/views/                  # Page components
│   ├── src/components/             # Shared layout components
│   ├── src/composables/            # API & Highcharts helpers
│   └── src/composables/useSeo.js   # Per-route SEO meta tags
├── backend/
│   ├── src/
│   │   ├── middleware/security.js  # Compression, rate limits, headers
│   │   ├── config/                 # Environment configuration
│   │   ├── db/                     # PostgreSQL, Doris & Redis clients
│   │   ├── services/cache.js       # Redis cache get/set/invalidate
│   │   ├── middleware/cache.js     # HTTP response cache middleware
│   │   ├── routes/                 # REST API routes
│   │   ├── services/warehouse.js   # Star-schema ETL
│   │   └── scripts/                # Migrations, seed, sync
│   └── Dockerfile                  # Multi-stage: builds Vue + API image
├── public/                         # Vue build output (generated)
│   └── data/                       # GeoJSON map layers
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
| 502 Bad Gateway in browser | API not on port 3000 — run `./scripts/diagnose-502.sh`. Redeploy without `PORT=8003` in `.env` (API always on 3000, nginx on 8003). |
| Doris FE unhealthy / `dependency failed to start` | Wrong `FE_SERVERS` format or corrupted volume — run `./scripts/reset-doris.sh`, then redeploy. On Linux: `sudo sysctl -w vm.max_map_count=2000000`. Server needs **8 GB+ RAM**. First start takes **3–5 min**. |
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
