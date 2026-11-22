import { emptyData } from './types.ts'
import type { Contact, Data } from './types.ts'

/** Upgrade older stored shapes (v1 had no `draft`/`connectedAt`, settings had no `linkedinRead`). */
function migrate(raw: Partial<Data> & { contacts?: Partial<Contact>[] }): Data {
  const base = emptyData()
  return {
    ...base,
    ...raw,
    version: 2,
    settings: { ...base.settings, ...(raw.settings ?? {}) },
    contacts: (raw.contacts ?? []).map(c => ({ ...c, requestedAt: c.requestedAt ?? null, connectedAt: c.connectedAt ?? null, draft: c.draft ?? null })) as Contact[],
  }
}

export async function load(): Promise<Data> {
  const raw = (await chrome.storage.local.get('data')).data as Partial<Data> | undefined
  return raw ? migrate(raw) : emptyData()
}

/** Serialises writes, including those from side panels in different windows. */
export async function update(change: (data: Data) => Data): Promise<void> {
  await navigator.locks.request('referral-data', async () => {
    await chrome.storage.local.set({ data: change(await load()) })
  })
}
