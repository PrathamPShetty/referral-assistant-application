declare module '*.css'

// The subset of the Chrome extension API this project uses.
declare namespace chrome {
  type Event<F> = { addListener(fn: F): void; removeListener(fn: F): void }
  namespace storage {
    interface Change { oldValue?: unknown; newValue?: unknown }
    interface Area {
      get(key: string): Promise<Record<string, unknown>>
      set(items: Record<string, unknown>): Promise<void>
      remove(key: string): Promise<void>
    }
    const local: Area
    const session: Area
    const onChanged: Event<(changes: Record<string, Change>, area: string) => void>
  }
  namespace tabs {
    interface Tab { id?: number; windowId: number; url?: string }
    function create(o: { url: string }): Promise<Tab>
    function query(o: { url?: string; active?: boolean; currentWindow?: boolean }): Promise<Tab[]>
  }
  namespace scripting {
    function executeScript<T>(o: { target: { tabId: number }; func: () => T }): Promise<{ result: T }[]>
  }
  namespace sidePanel {
    function open(o: { windowId: number }): Promise<void>
    function setPanelBehavior(o: { openPanelOnActionClick: boolean }): Promise<void>
  }
  namespace contextMenus {
    function create(o: { id: string; title: string; contexts: ['selection'] }): void
    function removeAll(): Promise<void>
    const onClicked: Event<(info: { selectionText?: string; pageUrl?: string }, tab?: tabs.Tab) => void>
  }
  namespace alarms {
    function get(name: string): Promise<object | undefined>
    function create(name: string, o: { delayInMinutes: number; periodInMinutes: number }): Promise<void>
    const onAlarm: Event<(alarm: { name: string }) => void>
  }
  namespace notifications {
    function create(id: string, o: { type: 'basic'; iconUrl: string; title: string; message: string }): Promise<string>
  }
  namespace action {
    function setBadgeText(o: { text: string }): Promise<void>
    function setBadgeBackgroundColor(o: { color: string }): Promise<void>
  }
  namespace permissions {
    function request(o: { origins: string[] }): Promise<boolean>
  }
  namespace runtime {
    const onInstalled: Event<() => void>
    function getURL(path: string): string
  }
}
