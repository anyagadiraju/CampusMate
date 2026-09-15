CAMPUSMATE FINAL SUBMISSION

Deploy this folder to the same Vercel project that contains your Supabase-connected CampusMate site.

For real OpenAI AI:
- Keep OPENAI_API_KEY in Vercel Environment Variables with Production enabled.
- Never put the key in index.html.

If OpenAI is unavailable (including when the API account has no credits), the built-in CampusMate fallback answers website-related questions using the current calendar/events/preferences in the browser. Unrelated questions keep the normal AI-unavailable message.

The package includes index.html, api/chat.js and vercel.json.
