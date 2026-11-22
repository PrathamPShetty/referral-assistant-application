import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Data } from '../lib/types.ts'

export interface App { data: Data; save(change: (data: Data) => Data): Promise<void>; fail(error: unknown): void }
export const AppContext = createContext<App | null>(null)
export const useApp = () => useContext(AppContext)!

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function Select<T extends Record<string, string>>({ options, value, onChange, label }: {
  options: T; value: keyof T & string; onChange(value: keyof T & string): void; label: string
}) {
  return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value as keyof T & string)}>
      {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </select>
  )
}

export function DeleteButton({ onDelete, what }: { onDelete(): void; what: string }) {
  const [armed, setArmed] = useState(false)
  return (
    <button className="link danger" onBlur={() => setArmed(false)} onClick={() => (armed ? onDelete() : setArmed(true))}>
      {armed ? `Really delete ${what}?` : 'Delete'}
    </button>
  )
}

export const openTab = (url: string) => void chrome.tabs.create({ url })
