import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { messages, context } = await req.json()

    const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''

    const systemPrompt = `Tu es le coach IA d'ÉLEV, une application de musculation et nutrition premium.
Réponds toujours en français, de manière directe, bienveillante et experte.
Sois concis (max 3 paragraphes). Pas de jargon inutile. Ton coaching = actionnable.
Contexte utilisateur: ${context || 'Inconnu'}`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-12),
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error?.message || `Groq error ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? "Je n'ai pas pu répondre."

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
