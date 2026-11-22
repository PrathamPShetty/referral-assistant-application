import type { Contact, ContactStatus, Data } from './types.ts'

export const MAX_FOLLOW_UPS = 2
const DAY = 86_400_000

export function due(data: Data, now = Date.now()): Contact[] {
  return data.contacts.filter(c =>
    (c.status === 'requested' || c.status === 'asked') && c.lastContactAt !== null &&
    c.followUps < MAX_FOLLOW_UPS && now - c.lastContactAt >= data.settings.followUpDays * DAY)
}

export function withStatus(c: Contact, status: ContactStatus, now = Date.now()): Contact {
  if (status === c.status) return c
  if (status === 'requested') return { ...c, status, lastContactAt: now, followUps: 0, requestedAt: now }
  if (status === 'asked') return { ...c, status, lastContactAt: now, followUps: 0 }
  if (status === 'connected') return { ...c, status, connectedAt: now }
  return { ...c, status }
}
