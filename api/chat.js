// ─── Lumen AI Backend ────────────────────────────────────────────────────────
// Groq (primary) → Gemini (fallback) → Anthropic (final fallback)
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, system } = req.body;
  if (!messages || !system) {
    return res.status(400).json({ error: 'Missing messages or system prompt' });
  }

  // Try providers in order
  const providers = [
    { name: 'Groq',      fn: callGroq      },
    { name: 'Gemini',    fn: callGemini    },
    { name: 'Anthropic', fn: callAnthropic },
  ];

  for (const provider of providers) {
    try {
      console.log(`[Lumen] Trying ${provider.name}...`);
      const text = await provider.fn(messages, system);
      console.log(`[Lumen] Success via ${provider.name}`);
      return res.status(200).json({ text, provider: provider.name });
    } catch (err) {
      console.warn(`[Lumen] ${provider.name} failed:`, err.message);
    }
  }

  return res.status(500).json({ error: 'All AI providers failed. Please try again.' });
}

// ─── GROQ ─────────────────────────────────────────────────────────────────────
async function callGroq(messages, system) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1000,
      messages: [
        { role: 'system', content: system },
        ...messages
      ]
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Groq HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── GEMINI ───────────────────────────────────────────────────────────────────
async function callGemini(messages, system) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 1000 }
      })
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Gemini HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

// ─── ANTHROPIC ────────────────────────────────────────────────────────────────
async function callAnthropic(messages, system) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Anthropic HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.content[0].text;
}
