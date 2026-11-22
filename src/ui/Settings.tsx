import { useState } from 'react'
import { ORIGINS } from '../lib/ai.ts'
import { parseBackup } from '../lib/backup.ts'
import type { Settings as Values } from '../lib/types.ts'
import { Field, Select, useApp } from './common.tsx'

const PROVIDERS = { template: 'Templates only (free, offline)', gemini: 'Google Gemini', openai: 'OpenAI' }
const LINKEDIN_ORIGIN = 'https://www.linkedin.com/*'

export function Settings() {
  const { data, save, fail } = useApp()
  const [form, setForm] = useState<Values>(data.settings)
  const [key, setKey] = useState('')
  const [notice, setNotice] = useState('')
  const set = (patch: Partial<Values>) => { setForm({ ...form, ...patch }); setNotice('') }

  async function submit() {
    const { provider } = form
    const origins: string[] = []
    if (provider !== 'template') origins.push(ORIGINS[provider])
    if (form.linkedinRead) origins.push(LINKEDIN_ORIGIN)
    // Must stay the first await, or Chrome no longer counts this as a user click.
    if (origins.length && !await chrome.permissions.request({ origins }))
      throw new Error('Permission was not granted. AI messages and the acceptance check each need access to their site.')
    if (provider !== 'template' && key.trim()) {
      const keys = ((await chrome.storage.local.get('keys')).keys ?? {}) as Record<string, string>
      await chrome.storage.local.set({ keys: { ...keys, [provider]: key.trim() } })
      setKey('')
    }
    await save(d => ({ ...d, settings: form }))
    setNotice('Saved')
  }

  function download() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'referral-assistant-backup.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  async function restore(file: File) {
    const next = parseBackup(await file.text())
    await save(() => next)
    setForm(next.settings)
    setNotice('Backup imported')
  }

  return <>
    <form className="card" onSubmit={e => { e.preventDefault(); submit().catch(fail) }}>
      <h2>About you</h2>
      <Field label="Your name"><input value={form.name} onChange={e => set({ name: e.target.value })} /></Field>
      <Field label="Your skills and background"><input value={form.skills} placeholder="Python, backend development and AI engineering" onChange={e => set({ skills: e.target.value })} /></Field>
      <Field label="Your school"><input value={form.school} placeholder="Srinivas Institute of Technology" onChange={e => set({ school: e.target.value })} /></Field>
      <div className="grid">
        <Field label="Follow up after (days)"><input type="number" required min="1" max="60" value={form.followUpDays} onChange={e => set({ followUpDays: Number(e.target.value) })} /></Field>
        <Field label="Connection note limit"><input type="number" required min="100" max="300" value={form.noteLimit} onChange={e => set({ noteLimit: Number(e.target.value) })} /></Field>
        <Field label="Weekly invite cap"><input type="number" required min="1" max="200" value={form.inviteCap} onChange={e => set({ inviteCap: Number(e.target.value) })} /></Field>
      </div>
      <p className="muted">The weekly invite cap limits how many Connect invites you send in 7 days. LinkedIn restricts accounts that send too many; keeping this well under ~100 protects your account.</p>
      <h2>Message writer</h2>
      <Select label="Message writer" options={PROVIDERS} value={form.provider} onChange={provider => { set({ provider }); setKey('') }} />
      {form.provider !== 'template' && <>
        <Field label="Model">
          <input required value={form.provider === 'gemini' ? form.geminiModel : form.openaiModel}
            onChange={e => set(form.provider === 'gemini' ? { geminiModel: e.target.value } : { openaiModel: e.target.value })} />
        </Field>
        <Field label="API key (leave blank to keep the saved one)"><input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></Field>
        <p className="muted">The key is stored unencrypted in this Chrome profile. Writing with AI sends the contact's first name and title, the job, and your profile to the provider.</p>
      </>}
      <h2>Acceptance check</h2>
      <label className="check">
        <input type="checkbox" checked={form.linkedinRead} onChange={e => set({ linkedinRead: e.target.checked })} />
        <span>Let me check LinkedIn for who accepted my invites</span>
      </label>
      <p className="muted">When on, the Outbox gets a button that reads your open LinkedIn Connections page to spot accepted invites and draft their referral messages. It only reads the page — it never clicks or sends. Saving asks for permission to access linkedin.com.</p>
      <button className="primary">Save settings</button>
      <span role="status">{notice}</span>
    </form>

    <section className="card">
      <h2>Backup</h2>
      <p className="muted">Exports never include API keys. Importing replaces all jobs, contacts and settings.</p>
      <button onClick={download}>Export data</button>
      <Field label="Import a backup">
        <input type="file" accept="application/json" onChange={e => { const file = e.target.files?.[0]; if (file) restore(file).catch(fail); e.target.value = '' }} />
      </Field>
      <button className="link danger" onClick={() => chrome.storage.local.remove('keys').then(() => setNotice('API keys removed'), fail)}>Remove saved API keys</button>
    </section>
  </>
}
