import { useState } from 'react'
import { generate } from '../lib/ai.ts'
import { KINDS, prompt, template } from '../lib/message.ts'
import type { Kind } from '../lib/message.ts'
import { withStatus } from '../lib/reminders.ts'
import type { Contact, Job } from '../lib/types.ts'
import { Select, openTab, useApp } from './common.tsx'

function initialKind(c: Contact): Kind {
  if (c.status === 'asked' || (c.status === 'requested' && c.lastContactAt)) return 'followUp'
  return c.degree === 'first' || c.status === 'connected' || c.status === 'replied' ? 'referral' : 'note'
}

export function Composer({ contact, job, onDone }: { contact: Contact; job: Job; onDone(): void }) {
  const { data: { settings }, save, fail } = useApp()
  const [kind, setKind] = useState<Kind>(() => initialKind(contact))
  const [text, setText] = useState(() => template(initialKind(contact), contact, job, settings))
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const tooLong = kind === 'note' && text.length > settings.noteLimit

  function edit(value: string) { setText(value); setCopied(false) }

  async function write() {
    setBusy(true)
    try {
      const keys = ((await chrome.storage.local.get('keys')).keys ?? {}) as Record<string, string>
      edit(await generate(settings, keys[settings.provider] ?? '', prompt(kind, contact, job, settings)))
    } catch (error) { fail(error) } finally { setBusy(false) }
  }

  async function markSent() {
    const now = Date.now()
    await save(d => ({
      ...d,
      contacts: d.contacts.map(c => {
        if (c.id !== contact.id) return c
        if (kind === 'followUp') return { ...c, lastContactAt: now, followUps: c.followUps + 1 }
        return { ...withStatus(c, kind === 'note' ? 'requested' : 'asked', now), lastContactAt: now, draft: null }
      }),
    }))
    onDone()
  }

  return (
    <div className="composer">
      <Select label="Message type" options={KINDS} value={kind} onChange={next => { setKind(next); edit(template(next, contact, job, settings)) }} />
      <textarea aria-label="Message" rows={9} value={text} disabled={busy} onChange={e => edit(e.target.value)} />
      <small className={tooLong ? 'danger' : 'muted'}>
        {text.length}{kind === 'note' ? ` / ${settings.noteLimit}` : ''} characters{tooLong ? '. Shorten it before sending.' : ''}
      </small>
      <div className="row">
        {settings.provider !== 'template' && <button disabled={busy} onClick={() => void write()}>{busy ? 'Writing…' : 'Write with AI'}</button>}
        <button className="primary" disabled={busy || tooLong} onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), fail)}>
          {copied ? 'Copied' : 'Copy message'}
        </button>
        <button onClick={() => openTab(contact.url)}>Open LinkedIn</button>
        <button onClick={() => void markSent()}>I sent it</button>
      </div>
    </div>
  )
}
