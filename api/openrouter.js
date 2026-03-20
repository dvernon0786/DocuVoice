// Serverless proxy for OpenRouter chat completions
// Accepts POST { model, messages, apiKey?, ... } and forwards to OpenRouter
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Parse body (Vercel may already provide req.body)
  let body = req.body
  if (!body) {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => (data += chunk))
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
      body = raw ? JSON.parse(raw) : {}
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }

  const { apiKey: clientApiKey, ...forwardBody } = body
  const apiKey = clientApiKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'No OpenRouter API key configured' })
  }

  try {
    const r = await fetch('https://api.openrouter.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(forwardBody)
    })

    const data = await r.json()
    return res.status(r.ok ? 200 : 500).json(data)
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
