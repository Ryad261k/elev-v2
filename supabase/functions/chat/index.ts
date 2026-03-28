import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { messages, context } = await req.json()

    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''

    const systemPrompt = `Tu es le coach IA d'ÉLEV, une application de musculation et nutrition premium.
Réponds toujours en français, de manière directe, bienveillante et experte.
Sois concis (max 3 paragraphes). Pas de jargon inutile. Ton coaching = actionnable.
Contexte utilisateur: ${context || 'Inconnu'}`

    // Convertit le format messages → Gemini
    const geminiContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 800, temperature: 0.7 },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || `Gemini error ${response.status}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Je n'ai pas pu répondre."

    return new Response(JSON.stringify({ content }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
