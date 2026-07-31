Deno.serve(async (request) => {
  try {
    const { instructions, messages, stream = false } = await request.json();

    if (
      typeof instructions !== "string" ||
      !instructions.trim() ||
      !Array.isArray(messages) ||
      !messages.length
    ) {
      return new Response(JSON.stringify({ error: "Instructions and messages are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("HF_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b:cerebras",
          messages: [
            { role: "system", content: instructions },
            ...messages,
          ],
          max_tokens: 700,
          temperature: 0.1,
          reasoning_effort: "low",
          stream,
        }),
      },
    );

    if (!response.ok) {
      const result = await response.json();
      return new Response(
        JSON.stringify({
          error:
            result?.error?.message ||
            result?.error ||
            "The AI provider could not complete this request.",
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (stream) {
      return new Response(response.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const result = await response.json();
    const answer = result.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
