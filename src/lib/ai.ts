import type { Settings } from './types.ts'

export const ORIGINS = {
  gemini: 'https://generativelanguage.googleapis.com/*',
  openai: 'https://api.openai.com/*',
} as const

export async function generate(s: Settings, key: string, prompt: string): Promise<string> {
  if (!key) throw new Error('Add your API key in Settings first.')
  const gemini = s.provider === 'gemini'
  const response = await fetch(
    gemini
      ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.geminiModel)}:generateContent`
      : 'https://api.openai.com/v1/responses',
    {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'content-type': 'application/json', ...(gemini ? { 'x-goog-api-key': key } : { authorization: `Bearer ${key}` }) },
      body: JSON.stringify(gemini
        ? { contents: [{ role: 'user', parts: [{ text: prompt }] }] }
        : { model: s.openaiModel, input: prompt, store: false }),
    },
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error?.message ?? `The AI request failed (${response.status}).`)

  const parts: { text?: string; type?: string; thought?: boolean }[] = gemini
    ? body.candidates?.[0]?.content?.parts ?? []
    : body.output?.flatMap((item: { content?: unknown[] }) => item.content ?? []) ?? []
  const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim()
  if (!text) throw new Error('The AI returned no text. Try again or use the template.')
  return text
}
