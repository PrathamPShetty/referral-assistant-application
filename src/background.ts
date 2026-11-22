import { due } from './lib/reminders.ts'
import { load } from './lib/store.ts'

const ALARM = 'follow-ups'

async function refreshBadge() {
  const list = due(await load())
  await chrome.action.setBadgeBackgroundColor({ color: '#b45309' })
  await chrome.action.setBadgeText({ text: list.length ? String(list.length) : '' })
  return list
}

async function remind() {
  const list = await refreshBadge()
  const today = new Date().toDateString()
  if (!list.length || (await chrome.storage.local.get('notifiedOn')).notifiedOn === today) return
  await chrome.notifications.create(ALARM, {
    type: 'basic', iconUrl: chrome.runtime.getURL('icon.png'), title: 'Referral follow-ups due',
    message: list.length === 1 ? `Follow up with ${list[0].name}.` : `${list.length} contacts are waiting for a follow-up.`,
  })
  await chrome.storage.local.set({ notifiedOn: today })
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  await chrome.contextMenus.removeAll()
  chrome.contextMenus.create({ id: 'use-selection', title: 'Find referrals for this job', contexts: ['selection'] })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // open() must run inside the click, before anything is awaited.
  if (tab) void chrome.sidePanel.open({ windowId: tab.windowId })
  void chrome.storage.session.set({ selection: { text: info.selectionText ?? '', url: info.pageUrl ?? '', at: Date.now() } })
})

// Alarms can be cleared on browser restart, so check whenever the worker starts.
void chrome.alarms.get(ALARM).then(alarm => {
  if (!alarm) return chrome.alarms.create(ALARM, { delayInMinutes: 1, periodInMinutes: 60 })
})
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) void remind() })
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.data) void refreshBadge() })
