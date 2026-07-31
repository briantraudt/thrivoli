const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MODEL = "openai/gpt-oss-120b:cerebras";

async function db(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Database logging is unavailable.");
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers || {}) },
  });
}

async function defaultOrgId() {
  const response = await db("org?select=id&limit=1");
  const rows = await response.json();
  return rows?.[0]?.id ?? null;
}

async function handleEvent(operation: string, payload: Record<string, unknown>) {
  const orgId = await defaultOrgId();
  if (operation === "feedback") {
    const interactionId = String(payload.interaction_id || "");
    const rating = Number(payload.rating);
    if (!interactionId || ![-1, 1].includes(rating)) throw new Error("Valid interaction and rating are required.");
    const response = await db("ai_feedback?on_conflict=interaction_id,user_id", { method: "POST", body: JSON.stringify({ interaction_id: interactionId, org_id: orgId, rating }) });
    if (!response.ok) throw new Error(await response.text());
    return { saved: true };
  }
  if (operation === "action_preview") {
    const title = String(payload.title || "Review Thrivoli AI analysis").slice(0, 180);
    const response = await db("ai_action", { method: "POST", body: JSON.stringify({ org_id: orgId, interaction_id: payload.interaction_id || null, action_type: payload.action_type || "create_follow_up_task", payload: { title }, status: "preview" }) });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    return { action_id: rows[0].id, preview: { title, effect: "Creates one internal follow-up task. No patient data is included." } };
  }
  if (operation === "action_confirm") {
    const actionId = String(payload.action_id || "");
    if (!actionId) throw new Error("Action ID is required.");
    const getResponse = await db(`ai_action?id=eq.${encodeURIComponent(actionId)}&status=eq.preview&select=*`);
    const actions = await getResponse.json();
    const action = actions?.[0];
    if (!action) throw new Error("This action is unavailable or was already handled.");
    const taskResponse = await db("task", { method: "POST", body: JSON.stringify({ org_id: action.org_id, title: action.payload?.title || "Review Thrivoli AI analysis", detail: "Created from a confirmed Thrivoli Intelligence recommendation.", kind: "administrative", priority: "normal", source: "thrivoli_ai", status: "open" }) });
    if (!taskResponse.ok) throw new Error(await taskResponse.text());
    const updateResponse = await db(`ai_action?id=eq.${encodeURIComponent(actionId)}`, { method: "PATCH", body: JSON.stringify({ status: "executed", confirmed_at: new Date().toISOString(), executed_at: new Date().toISOString() }) });
    if (!updateResponse.ok) throw new Error(await updateResponse.text());
    return { executed: true };
  }
  throw new Error("Unsupported operation.");
}

async function startInteraction(metadata: Record<string, unknown>) {
  try {
    const orgId = await defaultOrgId();
    await db("ai_interaction", { method: "POST", body: JSON.stringify({
      id: metadata.interaction_id,
      org_id: orgId,
      question: String(metadata.question || "").slice(0, 1200),
      answer_type: metadata.answer_type || "narrative",
      metric_keys: metadata.metric_keys || [],
      evidence: metadata.evidence || [],
      reporting_period: metadata.reporting_period || null,
      data_as_of: metadata.data_as_of || null,
      model: MODEL,
      status: "streaming",
    }) });
  } catch (error) { console.error("AI interaction start log failed", error); }
}

async function finishInteraction(interactionId: string, answer: string, startedAt: number, status = "completed") {
  try {
    await db(`ai_interaction?id=eq.${encodeURIComponent(interactionId)}`, { method: "PATCH", body: JSON.stringify({ answer: answer.slice(0, 8000), status, latency_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }) });
  } catch (error) { console.error("AI interaction completion log failed", error); }
}

function captureStream(stream: ReadableStream<Uint8Array>, interactionId: string, startedAt: number) {
  const [clientStream, auditStream] = stream.tee();
  const audit = (async () => {
    const reader = auditStream.getReader(); const decoder = new TextDecoder(); let buffer = ""; let answer = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true }); const lines = buffer.split(/\r?\n/); buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue; const data = line.slice(5).trim(); if (!data || data === "[DONE]") continue;
        try { const payload = JSON.parse(data); const delta = payload.choices?.[0]?.delta?.content; if (typeof delta === "string") answer += delta; } catch { /* ignore provider control events */ }
      }
    }
    await finishInteraction(interactionId, answer, startedAt);
  })();
  // @ts-ignore Supabase Edge Runtime extension
  EdgeRuntime.waitUntil(audit);
  return clientStream;
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    if (body.operation) {
      const result = await handleEvent(body.operation, body.payload || {});
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { instructions, messages, stream = false, metadata = {} } = body;
    if (typeof instructions !== "string" || !instructions.trim() || !Array.isArray(messages) || !messages.length) {
      return new Response(JSON.stringify({ error: "Instructions and messages are required." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (metadata.interaction_id) await startInteraction(metadata);

    const providerResponse = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("HF_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: instructions }, ...messages], max_tokens: 650, temperature: 0.1, reasoning_effort: "low", stream }),
    });

    if (!providerResponse.ok) {
      const result = await providerResponse.json();
      if (metadata.interaction_id) await finishInteraction(metadata.interaction_id, "", startedAt, "failed");
      return new Response(JSON.stringify({ error: result?.error?.message || result?.error || "The AI provider could not complete this request." }), { status: providerResponse.status, headers: { "Content-Type": "application/json" } });
    }

    if (stream && providerResponse.body) {
      const bodyStream = metadata.interaction_id ? captureStream(providerResponse.body, metadata.interaction_id, startedAt) : providerResponse.body;
      return new Response(bodyStream, { status: 200, headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
    }

    const result = await providerResponse.json(); const answer = result.choices?.[0]?.message?.content ?? "";
    if (metadata.interaction_id) await finishInteraction(metadata.interaction_id, answer, startedAt);
    return new Response(JSON.stringify({ answer }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
