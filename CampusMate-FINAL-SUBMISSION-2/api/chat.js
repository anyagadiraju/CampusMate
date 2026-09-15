export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !String(apiKey).trim()) {
    console.error('OPENAI_API_KEY is missing');
    return res.status(500).json({
      error: 'OPENAI_API_KEY is not available to this Production deployment. Check Vercel → Settings → Environment Variables → Production, then redeploy this same project.'
    });
  }

  try {
    const body = req.body || {};
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const history = Array.isArray(body.history) ? body.history : [];
    const context = body.context && typeof body.context === 'object' ? body.context : {};

    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const system = `You are CampusMate AI, a helpful college student assistant inside the CampusMate app.
Be concise, friendly, practical, and natural. Use the supplied CampusMate context when answering questions about the user's schedule, events, deadlines, classes, and interests. Do not invent CampusMate data. If the context does not contain the answer, say so and give a useful general answer.
Today: ${context.today || 'unknown'}
User name: ${context.userName || context.user?.name || 'Student'}
User preferences: ${JSON.stringify(context.preferences || [])}
Relevant CampusMate data: ${JSON.stringify(context.data || context.events || {})}`;

    const previous = history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content }));

    const messages = [
      { role: 'system', content: system },
      ...previous,
      { role: 'user', content: message }
    ];

    // Keep the model server-side. The frontend never receives the API key.
    const models = [...new Set([
      process.env.OPENAI_MODEL || 'gpt-4o-mini',
      'gpt-4.1-mini'
    ])];

    let lastStatus = 502;
    let lastError = 'OpenAI request failed.';

    for (const model of models) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${String(apiKey).trim()}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.4,
            max_tokens: 700
          })
        });

        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) return res.status(200).json({ reply });
          lastStatus = 502;
          lastError = 'OpenAI returned no text response.';
          break;
        }

        lastStatus = response.status;
        lastError = data?.error?.message || `OpenAI returned HTTP ${response.status}.`;
        console.error(`OpenAI error for ${model}:`, lastError);

        // A model-not-found error can safely try the second model.
        if (response.status !== 404 && data?.error?.code !== 'model_not_found') break;
      } catch (err) {
        lastStatus = 502;
        lastError = err?.message || 'Network error while contacting OpenAI.';
        console.error(`OpenAI exception for ${model}:`, lastError);
      }
    }

    return res.status(lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502).json({
      error: `CampusMate AI could not complete the request: ${lastError}`
    });
  } catch (error) {
    console.error('CampusMate chat handler error:', error);
    return res.status(500).json({ error: error?.message || 'Unable to reach the AI service right now.' });
  }
}
