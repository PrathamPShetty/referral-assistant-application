import { useState } from 'react'
import { scrapeProfiles } from '../content/linkedin-read.ts'
import { generate } from '../lib/ai.ts'
import { prompt } from '../lib/message.ts'
import { acceptedIds, outbox, reconcileDraft } from '../lib/queue.ts'
import { withStatus } from '../lib/reminders.ts'
import type { Contact } from '../lib/types.ts'
import { openTab, useApp } from './common.tsx'

const LINKEDIN_ORIGIN = 'https://www.linkedin.com/*'
const CONNECTIONS_URL = 'https://www.linkedin.com/mynetwork/invite-connect/connections/'

function OutboxCard({ contact }: { contact: Contact }) {
  const { data, save, fail } = useApp()
  const job = data.jobs.find(j => j.id === contact.jobId)
  const [text, setText] = useState(contact.draft?.text ?? '')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!job || !contact.draft) return null
  const draft = contact.draft

  const patch = (fn: (c: Contact) => Contact) =>
    save(d => ({ ...d, contacts: d.contacts.map(c => (c.id === contact.id ? fn(c) : c)) }))
  const saveText = () => { if (text !== draft.text) void patch(c => (c.draft ? { ...c, draft: { ...c.draft, text } } : c)) }

  async function rewrite() {
    setBusy(true)
    try {
      const keys = ((await chrome.storage.local.get('keys')).keys ?? {}) as Record<string, string>
      const next = await generate(data.settings, keys[data.settings.provider] ?? '', prompt('referral', contact, job!, data.settings))
      setText(next); setCopied(false)
      await patch(c => (c.draft ? { ...c, draft: { ...c.draft, text: next } } : c))
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  // Sending advances the contact to "Message sent" and starts the follow-up clock.
  const markSent = () => void patch(c => { const now = Date.now(); return { ...withStatus(c, 'asked', now), lastContactAt: now, draft: null } })

  return (
    <article className="card">
      <div className="heading">
        <div><h3>{contact.name}</h3><p className="muted">{contact.title || 'No title'} · {job.company}</p></div>
        <span className="tag strong">Accepted</span>
      </div>
      <textarea aria-label={`Message for ${contact.name}`} rows={8} value={text} disabled={busy}
        onChange={e => { setText(e.target.value); setCopied(false) }} onBlur={saveText} />
      <div className="row">
        {data.settings.provider !== 'template' && <button disabled={busy} onClick={() => void rewrite()}>{busy ? 'Writing…' : 'Rewrite with AI'}</button>}
        <button className="primary" disabled={busy} onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), fail)}>
          {copied ? 'Copied' : 'Copy message'}
        </button>
        <button onClick={() => openTab(contact.url)}>Open LinkedIn</button>
        <button onClick={markSent}>I sent it</button>
        <button className="link" onClick={() => void patch(c => ({ ...c, draft: null }))}>Dismiss</button>
      </div>
    </article>
  )
}

export function Outbox() {
  const { data, save, fail } = useApp()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const items = outbox(data)

  async function check() {
    setBusy(true); setNote('')
    try {
      // Must be the first await, so Chrome still counts this as a user gesture.
      if (!await chrome.permissions.request({ origins: [LINKEDIN_ORIGIN] })) throw new Error('Reading acceptances needs permission for linkedin.com.')
      const active = await chrome.tabs.query({ url: LINKEDIN_ORIGIN, active: true, currentWindow: true })
      const tab = active[0] ?? (await chrome.tabs.query({ url: LINKEDIN_ORIGIN }))[0]
      if (!tab?.id) { openTab(CONNECTIONS_URL); throw new Error('Opened your LinkedIn Connections page. Let it load, then check again.') }
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrapeProfiles })
      const scraped = res?.result ?? []
      let found = 0
      await save(d => {
        const ids = acceptedIds(d.contacts, scraped)
        found = ids.size
        const now = Date.now()
        return { ...d, contacts: d.contacts.map(c => ids.has(c.id)
          ? reconcileDraft(withStatus(c, 'connected', now), d.jobs.find(j => j.id === c.jobId), d.settings, now)
          : c) }
      })
      setNote(found ? `${found} new acceptance${found === 1 ? '' : 's'} — the message${found === 1 ? ' is' : 's are'} ready below.` : 'No new acceptances on that page.')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  return <>
    {data.settings.linkedinRead && (
      <section className="card">
        <p className="muted">Open your LinkedIn <b>Connections</b> page, then check. This only reads the page to see who accepted your invite — it never clicks or sends anything.</p>
        <div className="row">
          <button disabled={busy} onClick={() => void check()}>{busy ? 'Checking…' : 'Check LinkedIn for acceptances'}</button>
          <span role="status">{note}</span>
        </div>
      </section>
    )}
    {items.length
      ? items.map(c => <OutboxCard key={c.id} contact={c} />)
      : <p className="empty">No messages ready to send. When a contact accepts your invite — mark them <b>Connected</b>{data.settings.linkedinRead ? ', or use the check above' : ''} — their referral message is drafted here for you to review and send.</p>}
  </>
}
