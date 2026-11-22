import { useState } from 'react'
import { detectJob } from '../lib/detect.ts'
import { profileUrl, searches, webUrl } from '../lib/links.ts'
import { rank } from '../lib/rank.ts'
import { DEGREES } from '../lib/types.ts'
import type { Contact, Data, Degree, Job, JobDetails } from '../lib/types.ts'
import { ContactCard } from './ContactCard.tsx'
import { Field, Select, openTab, useApp } from './common.tsx'

export interface Draft { text: string; details: JobDetails | null }

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const findJob = (data: Data, d: JobDetails) => data.jobs.find(j => same(j.company, d.company) && same(j.role, d.role))

function upsertJob(data: Data, d: JobDetails): { data: Data; job: Job } {
  const existing = findJob(data, d)
  const url = webUrl(d.url) ?? ''
  const job: Job = existing
    ? { ...existing, location: d.location || existing.location, url: url || existing.url }
    : { id: crypto.randomUUID(), company: d.company.trim(), role: d.role.trim(), location: d.location, url, status: 'saved', createdAt: Date.now() }
  return { job, data: { ...data, jobs: existing ? data.jobs.map(j => (j.id === job.id ? job : j)) : [job, ...data.jobs] } }
}

function AddContact({ details }: { details: JobDetails }) {
  const { save, fail } = useApp()
  const blank = { name: '', title: '', url: '', degree: 'second' as Degree, mutuals: 0, alumni: false, known: false }
  const [form, setForm] = useState(blank)
  const set = (patch: Partial<typeof blank>) => setForm({ ...form, ...patch })

  async function submit() {
    const url = profileUrl(form.url)
    if (!url) return fail('Paste a profile link like https://www.linkedin.com/in/someone')
    await save(current => {
      const { data, job } = upsertJob(current, details)
      if (data.contacts.some(c => c.jobId === job.id && c.url === url)) throw new Error('That person is already saved for this job.')
      const contact: Contact = { ...form, url, id: crypto.randomUUID(), jobId: job.id, status: 'saved', lastContactAt: null, followUps: 0, notes: '', requestedAt: null, connectedAt: null, draft: null }
      return { ...data, contacts: [...data.contacts, contact] }
    })
    setForm(blank)
  }

  return (
    <form className="card" onSubmit={e => { e.preventDefault(); void submit().catch(() => {}) }}>
      <h2>3. Add someone you found</h2>
      <Field label="Name"><input required value={form.name} onChange={e => set({ name: e.target.value })} /></Field>
      <Field label="Their title"><input value={form.title} onChange={e => set({ title: e.target.value })} /></Field>
      <Field label="LinkedIn profile link"><input required value={form.url} onChange={e => set({ url: e.target.value })} /></Field>
      <div className="grid">
        <Field label="Connection"><Select label="Connection" options={DEGREES} value={form.degree} onChange={degree => set({ degree })} /></Field>
        <Field label="Mutual connections"><input type="number" min="0" max="9999" value={form.mutuals} onChange={e => set({ mutuals: Number(e.target.value) })} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={form.known} onChange={e => set({ known: e.target.checked })} />I know them personally</label>
      <label className="check"><input type="checkbox" checked={form.alumni} onChange={e => set({ alumni: e.target.checked })} />Same school as me</label>
      <button className="primary">Save contact</button>
    </form>
  )
}

export function Find({ draft, setDraft }: { draft: Draft; setDraft(draft: Draft): void }) {
  const { data, save } = useApp()
  const { details } = draft
  const job = details ? findJob(data, details) : undefined
  const people = job ? data.contacts.filter(c => c.jobId === job.id).sort((a, b) => rank(b, job).score - rank(a, job).score) : []
  const edit = (patch: Partial<JobDetails>) => details && setDraft({ ...draft, details: { ...details, ...patch } })

  return <>
    <section className="card">
      <h2>1. What are you applying for?</h2>
      <textarea aria-label="Job description or company" rows={4} value={draft.text}
        placeholder="I am applying for Software Engineer at WEX in Bengaluru, or paste a job description"
        onChange={e => setDraft({ ...draft, text: e.target.value })} />
      <button className="primary" disabled={!draft.text.trim()} onClick={() => setDraft({ ...draft, details: detectJob(draft.text) })}>Detect company and role</button>
      {details && <>
        <div className="grid">
          <Field label="Company"><input value={details.company} onChange={e => edit({ company: e.target.value })} /></Field>
          <Field label="Role"><input value={details.role} onChange={e => edit({ role: e.target.value })} /></Field>
          <Field label="Location"><input value={details.location} onChange={e => edit({ location: e.target.value })} /></Field>
          <Field label="Job link"><input value={details.url} onChange={e => edit({ url: e.target.value })} /></Field>
        </div>
        {!details.company.trim() && <p className="danger">No company found. Type it above.</p>}
        {details.company.trim() && <button onClick={() => void save(d => upsertJob(d, details).data)}>{job ? 'Update saved job' : 'Save job'}</button>}
      </>}
    </section>

    {details?.company.trim() && <>
      <section className="card">
        <h2>2. Find people at {details.company}</h2>
        <div className="searches">
          {searches(details, data.settings.school).map(s => (
            <button key={s.label} onClick={() => openTab(s.url)}><strong>{s.label}</strong><small>{s.hint}</small></button>
          ))}
        </div>
        <p className="muted">These are keyword searches, so check that each person works there now.
          {!data.settings.school && ' Add your school in Settings to get an alumni search.'}</p>
      </section>
      <AddContact details={details} />
      {people.length > 0 && <h2>4. Who to contact first</h2>}
      {people.map(c => <ContactCard key={c.id} contact={c} />)}
    </>}
  </>
}
