import { useState } from 'react'
import { template } from '../lib/message.ts'
import { invitesThisWeek, reconcileDraft } from '../lib/queue.ts'
import { categorize, rank } from '../lib/rank.ts'
import { due, withStatus } from '../lib/reminders.ts'
import { CATEGORIES, CONTACT_STATUS } from '../lib/types.ts'
import type { Contact } from '../lib/types.ts'
import { Composer } from './Composer.tsx'
import { DeleteButton, Select, openTab, useApp } from './common.tsx'

export function ContactCard({ contact }: { contact: Contact }) {
  const { data, save, fail } = useApp()
  const [open, setOpen] = useState(false)
  const job = data.jobs.find(j => j.id === contact.jobId)
  if (!job) return null
  const { score, reasons } = rank(contact, job)
  const atCap = invitesThisWeek(data) >= data.settings.inviteCap
  const change = (fn: (c: Contact) => Contact) =>
    void save(d => ({ ...d, contacts: d.contacts.map(c => (c.id === contact.id ? fn(c) : c)) }))

  // One-click assisted connect: copy the note, open their profile, mark as invited.
  // You press Send on LinkedIn yourself — nothing is sent automatically.
  function connect() {
    navigator.clipboard.writeText(template('note', contact, job!, data.settings)).then(() => {
      openTab(contact.url)
      change(c => withStatus(c, 'requested'))
    }, fail)
  }

  return (
    <article className="card">
      <div className="heading">
        <div><h3>{contact.name}</h3><p className="muted">{contact.title || 'No title'} · {job.company}</p></div>
        <span className="score" title="Relevance score out of 100">{score}</span>
      </div>
      <div className="tags">
        <span className="tag strong">{CATEGORIES[categorize(contact.title)]}</span>
        {reasons.map(reason => <span className="tag" key={reason}>{reason}</span>)}
        {due(data).some(c => c.id === contact.id) && <span className="tag warn">Follow-up due</span>}
        {contact.draft && <span className="tag strong">Draft ready</span>}
      </div>
      <div className="row">
        <Select label={`Status for ${contact.name}`} options={CONTACT_STATUS} value={contact.status} onChange={status => change(c => reconcileDraft(withStatus(c, status), job, data.settings))} />
        {contact.status === 'saved' && (
          <button className="primary" disabled={atCap} onClick={connect}
            title={atCap ? `Weekly invite cap of ${data.settings.inviteCap} reached — pause until next week` : 'Copy the note, open their profile, and mark as invited. You press Send.'}>
            Connect
          </button>
        )}
        <button onClick={() => setOpen(!open)}>{open ? 'Close' : 'Write message'}</button>
      </div>
      {open && <>
        <Composer contact={contact} job={job} onDone={() => setOpen(false)} />
        <textarea aria-label="Private notes" placeholder="Private notes" rows={2} defaultValue={contact.notes}
          onBlur={e => { const notes = e.target.value; if (notes !== contact.notes) change(c => ({ ...c, notes })) }} />
        <DeleteButton what={contact.name} onDelete={() => void save(d => ({ ...d, contacts: d.contacts.filter(c => c.id !== contact.id) }))} />
      </>}
    </article>
  )
}
