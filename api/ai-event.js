export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    return response.status(503).json({ error: "Thrivoli Intelligence is not configured yet." });
  }

  const type = request.body?.type;
  if (!['feedback', 'action_preview', 'action_confirm'].includes(type)) return response.status(400).json({ error: "Unsupported event." });

  try {
    const eventResponse = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`,
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation: type, payload: request.body?.payload || {} }),
    });
    const payload = await eventResponse.json();
    if (!eventResponse.ok) return response.status(eventResponse.status).json({ error: payload?.error || "The event could not be saved." });
    return response.status(200).json(payload);
  } catch (error) {
    console.error("Thrivoli AI event error", error);
    return response.status(500).json({ error: "The event could not be saved." });
  }
}
