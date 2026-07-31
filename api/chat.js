import { buildProactiveInsights, buildSystemInstructions, resolveQuestion } from "./_lib/thrivoli-intelligence.js";

function normalizeMessages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-10)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 1200) }));
}

export default async function handler(request, response) {
  if (request.method === "GET") return response.status(200).json({ insights: buildProactiveInsights() });
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    return response.status(503).json({ error: "Thrivoli Intelligence is not configured yet." });
  }

  const messages = normalizeMessages(request.body?.messages);
  if (!messages.length || messages.at(-1).role !== "user") return response.status(400).json({ error: "Please enter a question." });

  const question = messages.at(-1).content;
  const result = resolveQuestion(question, messages.slice(0, -1));
  const instructions = buildSystemInstructions(result);
  const startedAt = Date.now();

  try {
    const apiResponse = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`,
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instructions,
        messages,
        stream: true,
        metadata: {
          interaction_id: result.interactionId,
          question,
          answer_type: result.answerType,
          metric_keys: result.metricKey ? [result.metricKey] : [],
          evidence: result.evidence,
          data_as_of: result.dataAsOf,
          reporting_period: result.reportingPeriod,
          latency_started_at: new Date(startedAt).toISOString(),
        },
      }),
    });

    if (!apiResponse.ok) {
      const payload = await apiResponse.json();
      return response.status(502).json({ error: payload?.error?.message || payload?.error || "The AI service could not complete this request." });
    }
    if (!apiResponse.body) return response.status(502).json({ error: "The AI service returned an empty response." });

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();
    response.write(`data: ${JSON.stringify({ thrivoli: {
      interactionId: result.interactionId,
      answerType: result.answerType,
      card: result.card || null,
      chart: result.chart || null,
      evidence: result.evidence,
      dataAsOf: result.dataAsOf,
      dataStatus: result.dataStatus,
      roleScope: result.roleScope,
      unsupportedPeriod: result.unsupportedPeriod,
    } })}\n\n`);

    for await (const chunk of apiResponse.body) response.write(Buffer.from(chunk));
    return response.end();
  } catch (error) {
    console.error("Thrivoli chat error", error);
    return response.status(500).json({ error: "The assistant encountered a temporary error. Please try again." });
  }
}
