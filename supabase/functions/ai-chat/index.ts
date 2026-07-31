Deno.serve(async (request) => {
  try {
    const { prompt } = await request.json();

    if (typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "A prompt is required." }), {
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
          messages: [{ role: "user", content: prompt }],
          max_tokens: 900,
          temperature: 0.1,
          reasoning_effort: "low",
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
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
