import { useState } from 'react'
import { invitesThisWeek } from '../lib/queue.ts'
import { categorize, rank } from '../lib/rank.ts'
import { due } from '../lib/reminders.ts'
import { CATEGORIES, CONTACT_STATUS } from '../lib/types.ts'
import { ContactCard } from './ContactCard.tsx'
import { Select, useApp } from './common.tsx'

const FILTERS = { all: 'All contacts', due: 'Follow-up due', ...CONTACT_STATUS }
const ROLES = { all: 'All roles', ...CATEGORIES }

export function Contacts() {
  const { data } = useApp()
  const [filter, setFilter] = useState<keyof typeof FILTERS>('all')
  const [role, setRole] = useState<keyof typeof ROLES>('all')
  const [company, setCompany] = useState('all')
  const used = invitesThisWeek(data)
  const cap = data.settings.inviteCap
  const dueIds = new Set(due(data).map(c => c.id))
  const companyOf = (c: (typeof data.contacts)[number]) => data.jobs.find(j => j.id === c.jobId)?.company ?? ''
  const score = new Map(data.contacts.map(c => [c.id, rank(c, data.jobs.find(j => j.id === c.jobId)).score]))

  const companies: Record<string, string> = { all: 'All companies' }
  for (const name of [...new Set(data.contacts.map(companyOf))].filter(Boolean).sort()) companies[name] = name
  const companyValue = company in companies ? company : 'all' // reset if the selected company no longer has contacts

  const shown = data.contacts
    .filter(c => filter === 'all' || (filter === 'due' ? dueIds.has(c.id) : c.status === filter))
    .filter(c => role === 'all' || categorize(c.title) === role)
    .filter(c => companyValue === 'all' || companyOf(c) === companyValue)
    .sort((a, b) => Number(dueIds.has(b.id)) - Number(dueIds.has(a.id)) || score.get(b.id)! - score.get(a.id)!)

  return <>
    <p className={used >= cap ? 'danger' : 'muted'}>
      Invites this week: {used} / {cap}
      {used >= cap ? ' — cap reached, pause Connect until next week.' : used >= cap - 10 ? ' — nearing the weekly cap.' : ''}
    </p>
    <div className="row">
      <Select label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />
      <Select label="Filter by role" options={ROLES} value={role} onChange={setRole} />
      <Select label="Filter by company" options={companies} value={companyValue} onChange={setCompany} />
    </div>
    {shown.length ? shown.map(c => <ContactCard key={c.id} contact={c} />) : <p className="empty">No contacts match these filters.</p>}
  </>
}
