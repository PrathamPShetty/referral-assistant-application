import { profileUrl, webUrl } from './links.ts'
import { CONTACT_STATUS, DEGREES, JOB_STATUS, emptyData } from './types.ts'
import type { Data } from './types.ts'

// Imported files are untrusted: rebuild every record field by field.
export function parseBackup(json: string): Data {
  const raw = JSON.parse(json)
  if ((raw?.version !== 1 && raw?.version !== 2) || !Array.isArray(raw.jobs) || !Array.isArray(raw.contacts)) throw new Error('This is not a Referral Assistant backup.')
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10_000) : '')
  const num = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
  const one = <T extends object>(options: T, v: unknown, fallback: keyof T): keyof T =>
    typeof v === 'string' && Object.hasOwn(options, v) ? v as keyof T : fallback

  const data = emptyData()
  for (const j of raw.jobs) {
    if (!str(j?.id) || !str(j.company)) continue
    data.jobs.push({ id: str(j.id), company: str(j.company), role: str(j.role), location: str(j.location), url: webUrl(str(j.url)) ?? '', status: one(JOB_STATUS, j.status, 'saved'), createdAt: num(j.createdAt, 0, 0, 9e15) })
  }
  for (const c of raw.contacts) {
    const url = profileUrl(str(c?.url))
    if (!url || !str(c.id) || !str(c.name) || !data.jobs.some(j => j.id === c.jobId)) continue
    data.contacts.push({
      id: str(c.id), jobId: str(c.jobId), name: str(c.name), title: str(c.title), url,
      degree: one(DEGREES, c.degree, 'other'), mutuals: num(c.mutuals, 0, 0, 9999), alumni: c.alumni === true, known: c.known === true,
      status: one(CONTACT_STATUS, c.status, 'saved'), lastContactAt: typeof c.lastContactAt === 'number' ? c.lastContactAt : null,
      followUps: num(c.followUps, 0, 0, 99), notes: str(c.notes),
      // Drafts are not carried across a backup; they are regenerated from the template when needed.
      requestedAt: typeof c.requestedAt === 'number' ? c.requestedAt : null,
      connectedAt: typeof c.connectedAt === 'number' ? c.connectedAt : null, draft: null,
    })
  }
  const s = raw.settings ?? {}, d = data.settings
  data.settings = {
    ...d, name: str(s.name), skills: str(s.skills), school: str(s.school),
    followUpDays: num(s.followUpDays, d.followUpDays, 1, 60), noteLimit: num(s.noteLimit, d.noteLimit, 100, 300),
    inviteCap: num(s.inviteCap, d.inviteCap, 1, 200),
    // AI stays off after an import: host permission and keys are never part of a backup.
    geminiModel: str(s.geminiModel) || d.geminiModel, openaiModel: str(s.openaiModel) || d.openaiModel,
    // The acceptance check stays off until the host permission is granted again in Settings.
    linkedinRead: false,
  }
  return data
}
