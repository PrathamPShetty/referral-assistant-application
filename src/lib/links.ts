import type { JobDetails } from './types.ts'

export interface Search { label: string; hint: string; url: string }

export function searches(job: JobDetails, school: string): Search[] {
  const company = job.company.trim()
  if (!company) return []
  const make = (label: string, hint: string, terms: string, network?: 'F' | 'S'): Search => {
    const url = new URL('https://www.linkedin.com/search/results/people/')
    url.searchParams.set('keywords', `${company} ${terms}`.trim())
    if (network) url.searchParams.set('network', JSON.stringify([network]))
    return { label, hint, url: url.href }
  }
  const city = job.location.split(/[/,|]/).map(s => s.trim()).find(s => s && !/^(remote|hybrid)$/i.test(s))
  return [
    make('Your connections', '1st degree', '', 'F'),
    make('Friends of connections', '2nd degree', '', 'S'),
    ...(school ? [make('Alumni', school, school)] : []),
    ...(job.role ? [make('Same role', job.role, job.role)] : []),
    make('Recruiters you know', '1st-degree recruiters', 'Recruiter', 'F'),
    make('All recruiters', 'Recruiter', 'Recruiter'),
    make('Talent acquisition', 'Hiring contacts', 'Talent Acquisition'),
    make('Engineering managers', 'Possible hiring managers', 'Engineering Manager'),
    ...(city ? [make('Local employees', city, city)] : []),
  ]
}

export function profileUrl(value: string): string | null {
  try {
    const url = new URL(value.trim().replace(/^(?=(?:[a-z]+\.)?linkedin\.com\/)/i, 'https://'))
    if (url.protocol !== 'https:' || !/^(?:[a-z]+\.)?linkedin\.com$/.test(url.hostname)) return null
    const slug = url.pathname.match(/^\/in\/([^/]+)/)?.[1]
    return slug ? `https://www.linkedin.com/in/${slug}/` : null
  } catch { return null }
}

export function webUrl(value: string): string | null {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null } catch { return null }
}
