import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generate } from '../src/lib/ai.ts'
import { parseBackup } from '../src/lib/backup.ts'
import { detectJob } from '../src/lib/detect.ts'
import { profileUrl, searches, webUrl } from '../src/lib/links.ts'
import { prompt, template } from '../src/lib/message.ts'
import { WEEKLY_INVITE_CAP, acceptedIds, invitesThisWeek, outbox, reconcileDraft } from '../src/lib/queue.ts'
import { categorize, rank } from '../src/lib/rank.ts'
import { due, withStatus } from '../src/lib/reminders.ts'
import { emptyData } from '../src/lib/types.ts'
import type { Contact, Job } from '../src/lib/types.ts'

const cases: [string, string, string, string][] = [
  ['I want to apply to WEX', 'WEX', '', ''],
  ['i want to apply to wex', 'WEX', '', ''],
  ['I am applying for Software Engineer at WEX.', 'WEX', 'Software Engineer', ''],
  ['I am applying for Software Engineer at WEX in Bengaluru / Remote', 'WEX', 'Software Engineer', 'Bengaluru / Remote'],
  ['Senior Backend Engineer at Acme Labs', 'Acme Labs', 'Senior Backend Engineer', ''],
  ['Company: Foo Systems\nTitle: Data Engineer\nLocation: Pune', 'Foo Systems', 'Data Engineer', 'Pune'],
  ['About the job\nWe need you.\nAbout Zeta\nWe build banking software.', 'Zeta', '', ''],
  ['Razorpay is hiring a Frontend Developer in Bangalore', 'Razorpay', 'Frontend Developer', 'Bangalore'],
  ['Software Development Engineer at Amazon', 'Amazon', 'Software Development Engineer', ''],
  ['I am applying to Microsoft as a Data Scientist', 'Microsoft', 'Data Scientist', ''],
  ['I want to apply to Google.', 'Google', '', ''],
  ['Work at scale with meta programming and an apple a day', '', '', ''],
  ['hello there', '', '', ''],
]
for (const [input, company, role, location] of cases) {
  test(`detects: ${JSON.stringify(input)}`, () => {
    const got = detectJob(input)
    assert.deepEqual([got.company, got.role, got.location], [company, role, location])
  })
}

const job: Job = { id: 'j', company: 'WEX', role: 'Software Engineer', location: 'Remote / Bengaluru', url: 'https://example.com/job', status: 'saved', createdAt: 0 }
const person = (patch: Partial<Contact> = {}): Contact => ({ id: 'c', jobId: 'j', name: 'Asha Rao', title: 'Software Engineer', url: 'https://www.linkedin.com/in/asha/', degree: 'other', mutuals: 0, alumni: false, known: false, status: 'saved', lastContactAt: null, followUps: 0, notes: '', requestedAt: null, connectedAt: null, draft: null, ...patch })

test('job link is extracted', () => assert.equal(detectJob('See https://example.com/jobs/1.').url, 'https://example.com/jobs/1'))

test('searches', () => {
  const all = searches(job, 'SIT').map(s => new URL(s.url))
  const words = all.map(u => u.searchParams.get('keywords'))
  for (const k of ['WEX Recruiter', 'WEX Talent Acquisition', 'WEX Engineering Manager', 'WEX SIT', 'WEX Bengaluru', 'WEX Software Engineer']) assert.ok(words.includes(k), k)
  assert.equal(all[0].searchParams.get('network'), '["F"]')
  // Recruiters you already know: company + Recruiter keyword, scoped to 1st-degree connections.
  assert.ok(all.some(u => u.searchParams.get('keywords') === 'WEX Recruiter' && u.searchParams.get('network') === '["F"]'), '1st-degree recruiters')
  assert.equal(searches({ ...job, company: '' }, '').length, 0)
})

test('links reject unsafe hosts and schemes', () => {
  assert.equal(profileUrl('linkedin.com/in/asha?x=1'), 'https://www.linkedin.com/in/asha/')
  assert.equal(profileUrl('https://in.linkedin.com/in/asha/details'), 'https://www.linkedin.com/in/asha/')
  for (const bad of ['https://evil-linkedin.com/in/a', 'https://linkedin.com.evil.com/in/a', 'javascript:alert(1)', 'https://linkedin.com/company/wex']) assert.equal(profileUrl(bad), null)
  assert.equal(webUrl('javascript:alert(1)'), null)
})

test('categories and ranking', () => {
  assert.deepEqual(['Technical Recruiter', 'Engineering Manager', 'Senior Software Engineer', 'Accountant'].map(categorize), ['recruiter', 'manager', 'engineer', 'employee'])
  const score = (p: Partial<Contact>) => rank(person(p), job).score
  assert.ok(score({ known: true, degree: 'first' }) > score({ degree: 'first' }))
  assert.ok(score({ degree: 'first' }) > score({ degree: 'second' }))
  assert.ok(score({ alumni: true }) > score({}))
})

test('messages', () => {
  const s = emptyData().settings
  for (const role of ['', 'SDE', 'Senior Staff Machine Learning Platform Engineer '.repeat(5)]) assert.ok(template('note', person(), { ...job, role }, s).length <= s.noteLimit)
  assert.match(template('referral', person(), job, s), /refer me/)
  assert.doesNotMatch(template('referral', person({ title: 'Recruiter' }), job, s), /refer me/)
  const sent = prompt('referral', person({ notes: 'PRIVATE' }), job, s)
  for (const secret of ['Rao', 'PRIVATE', '/in/asha']) assert.ok(!sent.includes(secret), secret)
})

test('follow-ups', () => {
  const now = 100 * 86_400_000, data = emptyData(), sent = withStatus(person(), 'asked', now)
  data.contacts = [sent]
  assert.equal(due(data, now + 4 * 86_400_000).length, 0)
  assert.equal(due(data, now + 5 * 86_400_000).length, 1)
  data.contacts = [{ ...sent, followUps: 2 }]
  assert.equal(due(data, now * 2).length, 0)
  data.contacts = [withStatus(sent, 'replied', now)]
  assert.equal(due(data, now * 2).length, 0)
})

test('connecting drafts a referral into the outbox, sending clears it', () => {
  const s = emptyData().settings
  // A fresh contact has no draft; marking them connected drafts a referral.
  const connected = reconcileDraft(withStatus(person({ status: 'requested' }), 'connected'), job, s)
  assert.equal(typeof connected.connectedAt, 'number')
  assert.ok(connected.draft && /refer me/.test(connected.draft.text))
  // The draft shows up in the outbox…
  const data = { ...emptyData(), jobs: [job], contacts: [connected] }
  assert.deepEqual(outbox(data).map(c => c.id), ['c'])
  // …and reconciling after the message is sent (status away from connected) removes it.
  assert.equal(reconcileDraft({ ...connected, status: 'asked' }, job, s).draft, null)
  // No job, no draft (nothing to reference).
  assert.equal(reconcileDraft(withStatus(person(), 'connected'), undefined, s).draft, null)
})

test('acceptance check matches only invited contacts by profile url', () => {
  const invited = person({ id: 'a', status: 'requested', url: 'https://www.linkedin.com/in/asha/' })
  const saved = person({ id: 'b', status: 'saved', url: 'https://www.linkedin.com/in/bo/' })
  const scraped = [
    { href: 'https://www.linkedin.com/in/asha/' },   // invited → accepted
    { href: 'https://www.linkedin.com/in/bo/' },      // only saved, never invited → ignored
    { href: 'https://www.linkedin.com/in/stranger/' },// not a contact → ignored
  ]
  assert.deepEqual([...acceptedIds([invited, saved], scraped)], ['a'])
  assert.equal(acceptedIds([invited], []).size, 0)
})

test('weekly invite cap counts invites from the last 7 days', () => {
  const now = 100 * 86_400_000
  // Marking a contact requested stamps requestedAt.
  const invited = withStatus(person(), 'requested', now)
  assert.equal(invited.requestedAt, now)
  const data = { ...emptyData(), contacts: [
    invited,                                            // just now → counts
    person({ id: 'old', requestedAt: now - 8 * 86_400_000 }), // 8 days ago → not counted
    person({ id: 'never' }),                            // never invited → not counted
  ] }
  assert.equal(invitesThisWeek(data, now), 1)
  assert.ok(WEEKLY_INVITE_CAP > 0 && WEEKLY_INVITE_CAP <= 100)
  // The configurable Settings default matches the constant, and survives a backup round-trip.
  assert.equal(emptyData().settings.inviteCap, WEEKLY_INVITE_CAP)
  assert.equal(parseBackup(JSON.stringify({ ...emptyData(), settings: { ...emptyData().settings, inviteCap: 25 } })).settings.inviteCap, 25)
  assert.equal(parseBackup(JSON.stringify({ ...emptyData(), settings: { ...emptyData().settings, inviteCap: 9999 } })).settings.inviteCap, 200) // clamped to max
})

test('backup import is sanitised', () => {
  const data = { ...emptyData(), jobs: [{ ...job, url: 'javascript:x', status: '__proto__' }], contacts: [person(), person({ url: 'https://evil.com/in/x' })], keys: { gemini: 'k' } }
  const got = parseBackup(JSON.stringify(data))
  assert.equal(got.jobs[0].url, '')
  assert.equal(got.jobs[0].status, 'saved')
  assert.equal(got.contacts.length, 1)
  assert.ok(!('keys' in got))
  assert.throws(() => parseBackup('{}'))
})

test('both AI providers, with a stubbed network', async () => {
  const real = globalThis.fetch, calls: string[] = []
  try {
    globalThis.fetch = (async (url: string) => {
      calls.push(url)
      return Response.json(url.includes('openai') ? { output: [{ type: 'reasoning' }, { content: [{ text: 'O' }] }] } : { candidates: [{ content: { parts: [{ text: 'x', thought: true }, { text: 'G' }] } }] })
    }) as typeof fetch
    const s = emptyData().settings
    assert.equal(await generate({ ...s, provider: 'gemini' }, 'fake', 'p'), 'G')
    assert.equal(await generate({ ...s, provider: 'openai' }, 'fake', 'p'), 'O')
    assert.equal(calls.length, 2)
  } finally { globalThis.fetch = real }
})
