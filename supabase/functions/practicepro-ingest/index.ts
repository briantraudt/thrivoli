const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const INGEST_SECRET = Deno.env.get("THRIVOLI_INGEST_SECRET") ?? "";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validateRows(rows: unknown[]) {
  if (rows.length > 5000) throw new Error("A batch may contain at most 5,000 aggregate rows.");
  return rows.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Row ${index + 1} must be an object.`);
    const row = value as Record<string, unknown>;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(row.service_date, 10))) throw new Error(`Row ${index + 1} has an invalid service_date.`);
    if (!text(row.location_code, 40)) throw new Error(`Row ${index + 1} is missing location_code.`);
    const allowed = ["insurance", "school_contract", "cash_program", "other"];
    if (row.revenue_stream && !allowed.includes(text(row.revenue_stream, 30))) throw new Error(`Row ${index + 1} has an invalid revenue_stream.`);
    return row;
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!INGEST_SECRET || request.headers.get("x-thrivoli-ingest-secret") !== INGEST_SECRET) return json({ error: "Unauthorized." }, 401);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "The import service is not configured." }, 503);

  try {
    const body = await request.json();
    const rows = validateRows(Array.isArray(body.rows) ? body.rows : []);
    if (!rows.length) return json({ error: "At least one aggregate row is required." }, 400);

    const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ingest_analytics_batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_org_id: body.org_id,
        p_source: text(body.source) || "practicepro",
        p_idempotency_key: text(body.idempotency_key, 240),
        p_import_mode: body.import_mode === "historical" ? "historical" : "incremental",
        p_period_start: body.period_start,
        p_period_end: body.period_end,
        p_rows: rows,
        p_source_updated_at: body.source_updated_at || null,
      }),
    });
    const payload = await rpc.json();
    if (!rpc.ok) return json({ error: payload?.message || payload?.error || "The import failed." }, 422);
    return json(payload);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The import failed." }, 400);
  }
});
