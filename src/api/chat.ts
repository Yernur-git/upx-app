import type { VercelRequest, VercelResponse } from '@vercel/node';

// Supported providers routed through this proxy
const PROVIDER_URLS: Record<string, string> = {
  anthropic:  'https://api.anthropic.com/v1/messages',
  openai:     'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  groq:       'https://api.groq.com/openai/v1/chat/completions',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { provider, model, system, messages, max_tokens = 2000 } = req.body as {
    provider: string;
    model: string;
    system?: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens?: number;
  };

  if (!provider || !messages) {
    return res.status(400).json({ error: 'Missing provider or messages' });
  }

  // Pick API key from env — never from client
  const keyMap: Record<string, string | undefined> = {
    anthropic:  process.env.ANTHROPIC_API_KEY,
    openai:     process.env.OPENAI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    groq:       process.env.GROQ_API_KEY,
  };

  const apiKey = keyMap[provider];
  if (!apiKey) {
    return res.status(400).json({ error: `No API key configured for provider: ${provider}` });
  }

  const url = PROVIDER_URLS[provider];
  if (!url) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  try {
    let upstreamRes: Response;

    if (provider === 'anthropic') {
      upstreamRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens, system, messages }),
      });
    } else {
      const fullMessages = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      };
      if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://upx-app.vercel.app';
        headers['X-Title'] = 'UpX Planner';
      }

      upstreamRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model, max_tokens,
          messages: fullMessages,
          response_format: { type: 'json_object' },
        }),
      });
    }

    const data = await upstreamRes.json();

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Proxy error' });
  }
}