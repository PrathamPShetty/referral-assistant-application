import { profileUrl } from './links.ts'
import { template } from './message.ts'
import type { Contact, Data, Job, Settings } from './types.ts'

/**
 * The default weekly cap on connection invites (overridable in Settings as
 * `inviteCap`). LinkedIn restricts accounts that send roughly 100–200 invites a week;
 * staying well under that is the single biggest thing that keeps an account healthy.
 */
export const WEEKLY_INVITE_CAP = 80
const WEEK = 7 * 86_400_000

/** How many invites were sent in the last 7 days (by `requestedAt`). */
export function invitesThisWeek(d: Data, now = Date.now()): number {
  return d.contacts.filter(c => c.requestedAt !== null && now - c.requestedAt < WEEK).length
}

/**
 * Keep a contact's draft in sync with its status. A `connected` contact that has
 * no draft yet gets a referral message drafted for it; a contact that is no longer
 * `connected` (sent, declined, reset) loses any stale draft. Pure, so it is tested
 * directly. Call it right after any status change.
 */
export function reconcileDraft(c: Contact, job: Job | undefined, s: Settings, now = Date.now()): Contact {
  if (c.status !== 'connected') return c.draft ? { ...c, draft: null } : c
  if (c.draft || !job) return c
  return { ...c, draft: { kind: 'referral', text: template('referral', c, job, s), createdAt: now } }
}

/** Contacts who have accepted and have a message waiting for you to send. */
export function outbox(d: Data): Contact[] {
  return d.contacts.filter(c => c.status === 'connected' && c.draft)
}

/**
 * R (read-only acceptance check): given profile links scraped from a LinkedIn page,
 * the ids of contacts we had marked `requested` whose profile now appears — i.e. who
 * accepted. Matching is by normalised profile URL only, so an unrelated page yields
 * nothing and we never invent an acceptance.
 */
export function acceptedIds(contacts: Contact[], scraped: { href: string }[]): Set<string> {
  const urls = new Set<string>()
  for (const s of scraped) {
    const u = profileUrl(s.href)
    if (u) urls.add(u)
  }
  return new Set(contacts.filter(c => c.status === 'requested' && urls.has(c.url)).map(c => c.id))
}
