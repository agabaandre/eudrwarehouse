# Future Enhancements — MAAIF EUDR Platform

This document outlines planned enhancements beyond the MVP demonstration platform.

## 1. Kohtas EUDR API Integration

Integrate with the [Kohtas EUDR API](https://kohtas.com) for:
- Automated Due Diligence Statement (DDS) submission to EU TRACES NT
- Real-time geolocation validation against global forest cover datasets
- Standardized EUDR compliance certificate exchange with EU importers

**Implementation approach:** Add a `services/kohtas.js` adapter module, webhook handlers for async validation results, and a compliance workflow state machine (draft → validated → submitted → accepted).

## 2. Advanced GIS Capabilities

- Integrate full Uganda district/county GeoJSON from UBOS
- Satellite imagery overlay (Sentinel-2) for deforestation detection
- Farm polygon drawing and validation tools
- Proximity analysis to forest reserves, wetlands, and national parks
- PostGIS extension on PostgreSQL for spatial queries

## 3. Automated Risk Assessment

- Rule engine scoring farms based on:
  - Proximity to protected areas (<500m forest reserve, <1km national park)
  - Historical deforestation signals (GLAD alerts, Hansen dataset)
  - Slope analysis (>30° erosion risk)
  - Wetland overlap detection
- Batch risk recalculation pipeline (PostgreSQL → Doris)
- Alert generation for high-risk farm clusters

## 4. EU Due Diligence Statement (DDS) Generation

- Template-based PDF/JSON DDS export per EU Regulation 2023/1115
- Link farm plots to exporter batches and shipment records
- Geolocation coordinate submission in required format
- Audit trail for all DDS versions and amendments

## 5. Apache Superset Integration

**Status: Implemented in v1.1** — see [SUPERSET_GUIDE.md](SUPERSET_GUIDE.md)

Remaining enhancements:
- Pre-built dashboards mirroring public and management views
- SQL Lab for ad-hoc queries by MAAIF analysts
- Row-level security by district/region for district officers
- Embedded Superset charts in management dashboard via iframe/SDK

## 6. Self-Service Reporting

- Drag-and-drop report builder (dimensions: district, crop, compliance status, date range)
- Scheduled report generation and email delivery
- Export to PDF, Excel, CSV for regulatory submission
- Saved report templates per stakeholder group (MAAIF, district officers, exporters)

## 7. Direct Apache Doris Source Integration

- Stream ingestion via Routine Load from Kafka/Debezium CDC
- Flink or Doris Stream Load for high-volume mobile field data
- Separate OLAP schemas: `eudr_compliance`, `eudr_production`, `eudr_exports`
- Materialized views for sub-second dashboard refresh at national scale

## 8. Additional Platform Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Multi-tenant RBAC | High | Roles: admin, district officer, exporter, viewer |
| OAuth2/SSO | Medium | Integration with government identity provider |
| Offline mobile sync | High | Field agents collect data without connectivity |
| Blockchain traceability | Low | Immutable audit trail for export batches |
| Multi-language (Luganda, Swahili) | Medium | Localized dashboards and user guide |
| WhatsApp/SMS alerts | Medium | Notify farmers of compliance status changes |

## 9. Production Deployment Recommendations

- Kubernetes (EKS/GKE) with Helm charts
- Managed PostgreSQL (RDS/Cloud SQL) with read replicas
- Doris cluster (3 FE, 3+ BE nodes) for production analytics
- CDN for static dashboard assets
- TLS termination, WAF, and secrets management (Vault)
- Replace demo credentials with proper identity management

## 10. Data Governance

- Data retention policies aligned with Uganda Data Protection Act
- PII encryption at rest for farmer phone numbers and national IDs
- Audit logging for all compliance status changes
- Data quality monitoring dashboards

---

*This roadmap is intended for MAAIF stakeholder review and prioritization.*
