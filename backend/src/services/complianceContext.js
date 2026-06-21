const db = require('../db/postgres');

async function buildComplianceContext() {
  const [
    { rows: kpis },
    { rows: districts },
    { rows: alerts },
    { rows: trend },
    { rows: compliance },
  ] = await Promise.all([
    db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM farmers) AS total_farmers,
        (SELECT COUNT(*)::int FROM farm_plots) AS total_farm_plots,
        (SELECT COUNT(*)::int FROM districts) AS districts_covered,
        (SELECT COUNT(*)::int FROM compliance_records WHERE status = 'compliant') AS compliant_farms,
        (SELECT COUNT(*)::int FROM compliance_records WHERE status = 'non_compliant') AS non_compliant_farms,
        (SELECT COUNT(*)::int FROM compliance_records WHERE status = 'pending') AS pending_farms
    `),
    db.query(`
      SELECT name, region, compliance_rate, risk_score, total_farms, production_tons
      FROM districts ORDER BY compliance_rate DESC NULLS LAST LIMIT 15
    `),
    db.query(`
      SELECT alert_type, message, status FROM sms_alerts
      ORDER BY created_at DESC LIMIT 5
    `).catch(() => ({ rows: [] })),
    db.query(`
      SELECT year, month, compliant_pct, non_compliant_pct, pending_pct
      FROM compliance_trends ORDER BY year DESC, month DESC LIMIT 6
    `).catch(() => ({ rows: [] })),
    db.query(`
      SELECT status, COUNT(*)::int AS count FROM compliance_records GROUP BY status
    `).catch(() => ({ rows: [] })),
  ]);

  const k = kpis[0] || {};
  const total = (k.compliant_farms || 0) + (k.non_compliant_farms || 0) + (k.pending_farms || 0);
  const compliancePct = total ? Math.round(((k.compliant_farms || 0) / total) * 100) : 0;

  const lines = [
    '=== MAAIF EUDR PLATFORM — LIVE COMPLIANCE DEMO DATA ===',
    `Generated: ${new Date().toISOString().slice(0, 19)}Z`,
    '',
    'National KPIs:',
    `- Registered farmers: ${k.total_farmers ?? 0}`,
    `- Farm plots mapped: ${k.total_farm_plots ?? 0}`,
    `- Districts with data: ${k.districts_covered ?? 0}`,
    `- Compliant farm plots: ${k.compliant_farms ?? 0} (${compliancePct}%)`,
    `- Non-compliant: ${k.non_compliant_farms ?? 0}`,
    `- Pending review: ${k.pending_farms ?? 0}`,
    '',
    'Compliance breakdown:',
    ...compliance.map((c) => `- ${c.status}: ${c.count}`),
    '',
    'Top districts by compliance rate:',
    ...districts.slice(0, 10).map((d) => (
      `- ${d.name} (${d.region}): ${d.compliance_rate}% compliance, risk ${d.risk_score}, `
      + `${d.total_farms} farms, ${d.production_tons}t production`
    )),
    '',
    'Recent compliance trend (monthly):',
    ...trend.map((t) => (
      `- ${t.year}-${String(t.month).padStart(2, '0')}: `
      + `compliant ${t.compliant_pct}%, non-compliant ${t.non_compliant_pct}%, pending ${t.pending_pct}%`
    )),
  ];

  if (alerts.length) {
    lines.push('', 'Recent SMS/compliance alerts:');
    alerts.forEach((a) => lines.push(`- [${a.alert_type || 'alert'}] ${a.message}`));
  }

  lines.push(
    '',
    'High-risk districts (lowest compliance in sample):',
    ...[...districts].sort((a, b) => parseFloat(a.compliance_rate) - parseFloat(b.compliance_rate))
      .slice(0, 5)
      .map((d) => `- ${d.name}: ${d.compliance_rate}% (risk ${d.risk_score})`),
    '',
    'Use this data when answering questions about Uganda district performance, national compliance rates, or platform statistics.',
  );

  return lines.join('\n');
}

module.exports = { buildComplianceContext };
