import { webUrl } from '../lib/links.ts'
import { JOB_STATUS } from '../lib/types.ts'
import type { Job } from '../lib/types.ts'
import { DeleteButton, Select, openTab, useApp } from './common.tsx'

export function Jobs({ onSelect }: { onSelect(job: Job): void }) {
  const { data, save } = useApp()
  if (!data.jobs.length) return <p className="empty">No saved jobs yet. Save one from the Find tab.</p>
  return data.jobs.map(job => {
    const people = data.contacts.filter(c => c.jobId === job.id)
    const url = webUrl(job.url)
    return (
      <article className="card" key={job.id}>
        <h3>{job.company}</h3>
        <p className="muted">{[job.role, job.location].filter(Boolean).join(' · ')}</p>
        <p>{people.length} saved · {people.filter(c => c.lastContactAt).length} contacted · {people.filter(c => c.status === 'referred').length} referred</p>
        <Select label={`Status for ${job.company}`} options={JOB_STATUS} value={job.status}
          onChange={status => void save(d => ({ ...d, jobs: d.jobs.map(j => (j.id === job.id ? { ...j, status } : j)) }))} />
        <div className="row">
          <button onClick={() => onSelect(job)}>Find people</button>
          {url && <button onClick={() => openTab(url)}>Open job</button>}
          <DeleteButton what="this job and its contacts" onDelete={() => void save(d => ({
            ...d, jobs: d.jobs.filter(j => j.id !== job.id), contacts: d.contacts.filter(c => c.jobId !== job.id),
          }))} />
        </div>
      </article>
    )
  })
}
