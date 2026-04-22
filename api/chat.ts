
const URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { provider, model, system, messages, max_tokens = 2000 } = await req.json();

    if (!provider || !messages) {
      return new Response(JSON.stringify({ error: "Missing provider or messages" }), { status: 400 });
    }

    const keys: Record<string, string | undefined> = {
      anthropic: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
      groq: process.env.GROQ_API_KEY,
    };

    const apiKey = keys[provider];
    const url = URLS[provider];

    if (!apiKey || !url) {
      return new Response(JSON.stringify({ error: "Invalid provider or missing API key" }), { status: 400 });
    }

    let upstream: Response;

    if (provider === "anthropic") {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({ model, system, messages, max_tokens }),
      });
    } else {
      const fullMessages = system
        ? [{ role: "system", content: system }, ...messages]
        : messages;

      const headers: Record<string, string> = {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      };

      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://upx-app.vercel.app";
        headers["X-Title"] = "UpX Planner";
      }

      upstream = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          max_tokens,
          messages: fullMessages,
        }),
      });
    }

    const data = await upstream.json();

    return new Response(JSON.stringify(data), {
      status: upstream.status,
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Proxy error" }), { status: 500 });
  }
}