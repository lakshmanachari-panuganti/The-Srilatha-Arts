/**
 * Azure OpenAI GPT-4o Vision — product content generation.
 *
 * Reads an artwork image URL (already on our public product-images blob
 * container, written there by /api/admin/upload) and asks GPT-4o Vision
 * to produce SEO-friendly e-commerce copy for it.
 *
 * Returns a strict JSON shape that the admin product form maps 1:1 onto
 * the title / shortDescription / description / material / careInstructions
 * fields. No other fields are touched (price / category / stock /
 * featured flags are deliberately out of scope — those are business
 * decisions, not AI's call).
 *
 * Implementation notes:
 *   - Talks to Azure OpenAI via raw fetch instead of pulling in the
 *     `openai` SDK. The single chat-completions call is small enough that
 *     the SDK's ergonomics aren't worth the extra package weight inside
 *     the Functions zip.
 *   - response_format: { type: "json_object" } gates the model to valid
 *     JSON. We still validate before returning so a corrupt response
 *     surfaces as a 502, not as bad data on the product row.
 *   - 30 s hard timeout via AbortController — GPT-4o Vision typically
 *     responds in 4–10 s; anything beyond 30 s is a stalled request.
 */

export interface AiProductContent {
  title: string
  shortDescription: string
  description: string
  material: string
  careInstructions: string
}

export class AiContentError extends Error {
  /** HTTP status to surface to the client. */
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
    this.name = 'AiContentError'
  }
}

const PROMPT = [
  'You are an expert ecommerce content writer specializing in handmade artwork and home decor products.',
  '',
  'Analyze the uploaded artwork image and generate high-quality ecommerce content.',
  '',
  'Return ONLY valid JSON matching this schema:',
  '{',
  '  "title": "",',
  '  "shortDescription": "",',
  '  "description": "",',
  '  "material": "",',
  '  "careInstructions": ""',
  '}',
  '',
  'Rules:',
  '- Create an SEO-friendly product title (under 80 characters).',
  '- shortDescription must be under 160 characters — a single line, suitable for product cards.',
  '- description should be a detailed ecommerce product description (2–4 short paragraphs).',
  '- material: suggest likely materials used (e.g. "MDF · resin · gold leaf").',
  '- careInstructions: practical guidance for the buyer (avoid sunlight, dust with soft cloth, etc.).',
  '- Return JSON only — no markdown fences, no commentary, no leading or trailing prose.',
].join('\n')

export async function generateProductContent(imageUrl: string): Promise<AiProductContent> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'

  if (!endpoint || !apiKey || !deployment) {
    throw new AiContentError(
      'AI content generation is not configured on the server. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT_NAME.',
      503,
    )
  }
  if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
    throw new AiContentError('A valid image URL is required.', 400)
  }

  // Normalise the endpoint: accept both
  //   https://acct.openai.azure.com
  //   https://acct.openai.azure.com/
  // and build the chat completions URL deterministically.
  const base = endpoint.replace(/\/+$/, '')
  const url = `${base}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 900,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new AiContentError('AI generation timed out. Please try again.', 504)
    }
    throw new AiContentError('Could not reach the AI service.', 502)
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    // Surface Azure's status (4xx / 5xx) so the route handler can log it,
    // but always return a generic message to the client.
    throw new AiContentError(
      `Azure OpenAI returned ${response.status}: ${text.slice(0, 500)}`,
      response.status >= 500 ? 502 : 400,
    )
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const raw = payload?.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new AiContentError('AI service returned an empty response.', 502)
  }

  return parseAndValidate(raw)
}

function parseAndValidate(raw: string): AiProductContent {
  // The model is configured with response_format json_object so this
  // should be pure JSON, but defend against the occasional ```json fence
  // some deployments still emit.
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()

  let obj: unknown
  try {
    obj = JSON.parse(stripped)
  } catch {
    throw new AiContentError('AI response was not valid JSON.', 502)
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new AiContentError('AI response had unexpected shape.', 502)
  }

  const o = obj as Record<string, unknown>
  const get = (key: string): string => {
    const v = o[key]
    return typeof v === 'string' ? v.trim() : ''
  }

  const content: AiProductContent = {
    title: get('title').slice(0, 200),
    shortDescription: get('shortDescription').slice(0, 200),
    description: get('description').slice(0, 4000),
    material: get('material').slice(0, 300),
    careInstructions: get('careInstructions').slice(0, 1000),
  }

  // Title is the only field we hard-require — the others can reasonably
  // be empty for some images (e.g. minimalist piece with no obvious
  // material). A blank title means the model effectively returned
  // nothing useful and we should fail loudly instead of pasting "" into
  // a form.
  if (!content.title) {
    throw new AiContentError('AI response was missing a title.', 502)
  }
  return content
}
