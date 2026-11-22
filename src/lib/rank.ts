import type { Category, Contact, Job } from './types.ts'

export function categorize(title: string): Category {
  if (/recruit|talent|sourcer|human resources|\bhr\b|staffing/i.test(title)) return 'recruiter'
  if (/\b(manager|director|head of|vp|vice president|cto)\b/i.test(title)) return 'manager'
  if (/engineer|developer|architect|programmer|scientist|\bsde\b/i.test(title)) return 'engineer'
  return 'employee'
}

const GENERIC = new Set(['senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal', 'associate', 'of', 'and'])
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w && !GENERIC.has(w))

export function rank(contact: Contact, job?: Job): { score: number; reasons: string[] } {
  const signals: [number, string][] = []
  if (contact.known) signals.push([25, 'You know them'])
  if (contact.degree === 'first') signals.push([30, '1st degree'])
  if (contact.degree === 'second') signals.push([15, '2nd degree'])
  if (contact.alumni) signals.push([15, 'Alumni'])
  if (contact.mutuals > 0) signals.push([Math.min(10, contact.mutuals * 2), `${contact.mutuals} mutual`])

  const target = words(job?.role ?? '')
  const title = new Set(words(contact.title))
  const overlap = target.length ? target.filter(w => title.has(w)).length / target.length : 0
  if (overlap >= 0.5) signals.push([Math.round(overlap * 15), 'Similar role'])

  const byCategory = { recruiter: 10, manager: 10, engineer: 5, employee: 0 }[categorize(contact.title)]
  return {
    score: Math.min(100, byCategory + signals.reduce((sum, [points]) => sum + points, 0)),
    reasons: signals.map(([, reason]) => reason),
  }
}
