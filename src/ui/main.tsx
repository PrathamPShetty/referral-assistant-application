import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { detectJob } from '../lib/detect.ts'
import { outbox } from '../lib/queue.ts'
import { due } from '../lib/reminders.ts'
import { load, update } from '../lib/store.ts'
import type { Data } from '../lib/types.ts'
import { AppContext } from './common.tsx'
import { Contacts } from './Contacts.tsx'
import { Find } from './Find.tsx'
import type { Draft } from './Find.tsx'
import { Jobs } from './Jobs.tsx'
import { Outbox } from './Outbox.tsx'
import { Settings } from './Settings.tsx'
import './panel.css'

const TABS = { find: 'Find', contacts: 'Contacts', outbox: 'Outbox', jobs: 'Jobs', settings: 'Settings' }

function Root() {
  const [data, setData] = useState<Data>()
  const [tab, setTab] = useState<keyof typeof TABS>('find')
  const [draft, setDraftState] = useState<Draft>({ text: '', details: null })
  const [error, setError] = useState('')

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e))
  function setDraft(next: Draft) {
    setDraftState(next)
    chrome.storage.session.set({ draft: next }).catch(fail)
  }

  useEffect(() => {
    function useSelection(value: unknown) {
      const { text, url } = value as { text: string; url: string }
      const details = detectJob(text)
      setDraft({ text, details: { ...details, url: details.url || url } })
      setTab('find')
      void chrome.storage.session.remove('selection')
    }
    function changed(changes: Record<string, chrome.storage.Change>, area: string) {
      if (area === 'local' && changes.data?.newValue) setData(changes.data.newValue as Data)
      if (area === 'session' && changes.selection?.newValue) useSelection(changes.selection.newValue)
    }
    chrome.storage.onChanged.addListener(changed)
    Promise.all([load(), chrome.storage.session.get('draft'), chrome.storage.session.get('selection')]).then(([loaded, saved, picked]) => {
      setData(loaded)
      if (saved.draft) setDraftState(saved.draft as Draft)
      if (picked.selection) useSelection(picked.selection)
    }, fail)
    return () => chrome.storage.onChanged.removeListener(changed)
  }, [])

  if (!data) return <p className="empty">{error || 'Loading…'}</p>

  async function save(change: (data: Data) => Data) {
    try { await update(change); setError('') } catch (e) { fail(e); throw e }
  }
  const dueCount = due(data).length
  const outboxCount = outbox(data).length
  const badges: Partial<Record<keyof typeof TABS, number>> = { contacts: dueCount, outbox: outboxCount }

  return (
    <AppContext value={{ data, save, fail }}>
      <header>
        <h1>Referral Assistant</h1>
        <nav>
          {Object.entries(TABS).map(([id, label]) => (
            <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id as keyof typeof TABS)}>
              {label}{(badges[id as keyof typeof TABS] ?? 0) > 0 && <span className="count">{badges[id as keyof typeof TABS]}</span>}
            </button>
          ))}
        </nav>
      </header>
      {error && <div className="error" role="alert">{error}<button className="link" onClick={() => setError('')}>Dismiss</button></div>}
      <main>
        {tab === 'find' && <Find draft={draft} setDraft={setDraft} />}
        {tab === 'contacts' && <Contacts />}
        {tab === 'outbox' && <Outbox />}
        {tab === 'jobs' && <Jobs onSelect={job => {
          setDraft({ text: '', details: { company: job.company, role: job.role, location: job.location, url: job.url } })
          setTab('find')
        }} />}
        {tab === 'settings' && <Settings />}
      </main>
    </AppContext>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
