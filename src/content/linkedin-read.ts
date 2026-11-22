/**
 * Runs INSIDE the LinkedIn tab via chrome.scripting.executeScript, so it must be
 * fully self-contained: no imports, no references to module scope. It only READS the
 * page — it collects profile links and their visible text and returns them. It never
 * clicks, types or navigates. Matching the results to your contacts happens back in
 * the panel (see acceptedIds in ../lib/queue.ts).
 */
export function scrapeProfiles(): { href: string; name: string }[] {
  const seen = new Set<string>()
  const out: { href: string; name: string }[] = []
  for (const el of Array.from(document.querySelectorAll('a[href*="/in/"]'))) {
    const href = (el as HTMLAnchorElement).href
    if (!href || seen.has(href)) continue
    seen.add(href)
    out.push({ href, name: (el.textContent ?? '').replace(/\s+/g, ' ').trim() })
  }
  return out
}
