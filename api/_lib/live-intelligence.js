const number = (value) => value == null ? null : Number(value);

function mapMetrics(row) {
  const metrics = row.metrics || {};
  return {
    name: row.location_name,
    visits: number(metrics.visits) || 0,
    breakEven: number(metrics.break_even_visits) || 0,
    projectedVisits: number(metrics.projected_visits),
    revenue: number(metrics.net_revenue) || 0,
    revenuePerVisit: number(metrics.revenue_per_visit),
    margin: number(metrics.margin),
    capacity: number(metrics.fill_rate),
    noShowRate: number(metrics.no_show_rate),
    openSlots: number(metrics.open_slots) || 0,
  };
}

export async function loadLiveIntelligenceDataset() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY || !process.env.THRIVOLI_AI_INTERNAL_SECRET) return null;
  try {
    const response = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`,
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
        "x-thrivoli-internal-secret": process.env.THRIVOLI_AI_INTERNAL_SECRET,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation: "metric_snapshot", payload: {} }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.live || !Array.isArray(payload.rows) || !payload.rows.length) return null;

    const locations = payload.rows.map(mapMetrics).filter((item) => item.name);
    const revenue = locations.reduce((sum, item) => sum + item.revenue, 0);
    const visits = locations.reduce((sum, item) => sum + item.visits, 0);
    const operatingIncome = payload.rows.reduce((sum, row) => sum + (number(row.metrics?.operating_income) || 0), 0);
    const organization = {
      name: payload.organization_name || "Organization",
      revenue,
      visits,
      breakEven: locations.reduce((sum, item) => sum + item.breakEven, 0),
      operatingMargin: revenue ? operatingIncome / revenue : null,
    };
    const asOf = payload.as_of_date;
    const periodStart = payload.period_start;
    const reportingPeriod = periodStart && asOf ? `${periodStart} through ${asOf} month-to-date` : "Current month-to-date";
    return {
      locations,
      organization,
      reportingPeriod,
      dataAsOf: payload.data_as_of || `${asOf}T23:59:59Z`,
      roleScope: payload.role_scope || "Executive — all authorized locations",
    };
  } catch (error) {
    console.error("Live metric snapshot unavailable", error);
    return null;
  }
}
