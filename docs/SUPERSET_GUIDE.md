# Apache Superset — Quick Guide

## Access

| Setting | URL | Credentials |
|---------|-----|-------------|
| Superset BI | http://localhost:8088 | `admin` / `admin` |

## Public vs Private Mode

Controlled by `SUPERSET_PUBLIC_ENABLED` in `.env` or `docker-compose.warehouse.yml`:

| Value | Behaviour |
|-------|-----------|
| `true` | Superset link and credentials shown on the **public landing page** |
| `false` (default) | Superset link only in the **management dashboard** after login |

## Pre-configured Data Sources

On startup, Superset auto-registers:

1. **EUDR Doris Warehouse** — `mysql+pymysql://root@doris-fe:9030/eudr_analytics`
2. **EUDR PostgreSQL OLTP** — operational database for live queries

## Creating Your First Dashboard

1. Open http://localhost:8088 and login with `admin` / `admin`
2. Go to **Data → Databases** — verify both connections are present
3. Go to **Data → Datasets** → **+ Dataset**
4. Select **EUDR Doris Warehouse** → choose `dim_district` or `fact_compliance`
5. Go to **Charts** → **+ Chart** → pick dataset → choose visualization
6. Go to **Dashboards** → **+ Dashboard** → add your charts

## Recommended Doris Tables for EUDR Reports

| Table | Use Case |
|-------|----------|
| `dim_district` | District compliance choropleth, regional filters |
| `fact_compliance` | Compliance trend over time |
| `fact_production` | Coffee/cocoa production analysis |
| `fact_exports` | EU destination volume reports |
| `fact_farm_geo` | Farm-level geospatial analysis |
| `agg_regional_summary` | Executive regional KPI summary |

## Sample SQL (SQL Lab)

```sql
-- Top 10 districts by compliance
SELECT district_name, region, compliance_rate, risk_score
FROM dim_district
ORDER BY compliance_rate DESC
LIMIT 10;

-- Monthly compliance trend
SELECT d.year, d.month_name, AVG(f.compliance_rate) AS avg_compliance
FROM fact_compliance f
JOIN dim_date d ON f.date_key = d.date_key
GROUP BY d.year, d.month, d.month_name
ORDER BY d.year, d.month;
```

## Syncing Warehouse Data

Before querying in Superset, ensure Doris has fresh data:

```bash
# Automatic on API startup (when warehouse stack is running)
# Manual trigger (requires management login token):
curl -X POST http://localhost:3000/api/warehouse/sync \
  -H "Authorization: Bearer <token>"
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Superset won't start | Wait 2–3 min on first run; check `docker compose logs superset` |
| No databases in Superset | Re-run `docker compose restart superset` after Doris is healthy |
| Empty charts | Run warehouse sync: `POST /api/warehouse/sync` |
| Connection refused | Ensure full stack: `docker compose -f docker-compose.yml -f docker-compose.warehouse.yml up` |
