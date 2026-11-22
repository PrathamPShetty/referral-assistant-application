import type { JobDetails } from './types.ts'

// Local heuristics only. The UI always lets the user correct the result.
const COMPANIES = ['WEX', 'Microsoft', 'Google', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Nvidia', 'Adobe', 'Salesforce', 'Oracle', 'IBM', 'Intel', 'Cisco', 'SAP', 'Accenture', 'Infosys', 'TCS', 'Wipro', 'Flipkart', 'Swiggy', 'Zomato', 'Razorpay', 'PhonePe', 'Walmart', 'Uber', 'Atlassian', 'Intuit', 'PayPal', 'ServiceNow', 'Deloitte', 'Capgemini', 'Cognizant', 'Stripe']
// These are also ordinary words, so only match them with their capital letter.
const AMBIGUOUS = new Set(['Apple', 'Meta', 'Intel', 'Stripe', 'Uber'])
const PLACES = ['Bengaluru', 'Bangalore', 'Mangaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Chennai', 'Delhi', 'Gurugram', 'Gurgaon', 'Noida', 'Kolkata', 'Kochi', 'India', 'London', 'Singapore', 'Dubai', 'New York', 'San Francisco', 'Seattle', 'Remote', 'Hybrid']
const ROLE = /\b(?:(?:senior|sr\.?|junior|jr\.?|lead|staff|principal|associate) )?(?:(?:software|backend|back-end|frontend|front-end|full[ -]stack|machine learning|ml|ai|data|devops|cloud|platform|python|java|react|qa|mobile|android|ios|site reliability|security|product|business|ui\/ux|engineering) ){1,3}(?:development engineer|engineer|developer|scientist|analyst|architect|manager|designer|intern)\b/i
const NOT_COMPANY = /^(?:the|a|an|us|our|you|this|that|job|role|company|team|position|least|scale|work|home|remote|software|senior|engineer)$/i
const NAME = String.raw`([A-Z][\w&-]*(?:\.[\w-]+)*(?: [A-Z&][\w&-]*(?:\.[\w-]+)*){0,3})`

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function company(text: string): string {
  const label = text.match(/^[ \t]*(?:company(?: name)?|employer|organi[sz]ation)[ \t]*[:–-][ \t]*(.+)$/im)
  if (label) return label[1].trim().slice(0, 80)

  const patterns = [
    String.raw`\b(?:[Aa]pply|[Aa]pplying) (?:to|at|with) ${NAME}`,
    String.raw`\b(?:at|At|@|[Jj]oin) ${NAME}`,
    String.raw`(?:^|\n)[ \t]*About ${NAME}[ \t]*(?:\n|$)`,
    String.raw`(?:^|[.!\n])[ \t]*${NAME} (?:is hiring|is looking for|is seeking|is an? )`,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(new RegExp(pattern, 'g'))) {
      const name = match[1].replace(/ (?:In|As|For)\b.*$/, '').trim()
      if (!NOT_COMPANY.test(name.split(' ')[0]) && !PLACES.includes(name)) return name
    }
  }

  return COMPANIES
    .map(name => ({ name, at: text.search(new RegExp(`\\b${escape(name)}\\b`, AMBIGUOUS.has(name) ? '' : 'i')) }))
    .filter(hit => hit.at >= 0)
    .sort((a, b) => a.at - b.at)[0]?.name ?? ''
}

export function detectJob(input: string): JobDetails {
  const text = input.replace(/\r/g, '')
  const url = text.match(/https:\/\/[^\s<>"']+/)?.[0].replace(/[.,;)\]]+$/, '') ?? ''
  const prose = text.replace(/https?:\/\/\S+/g, '')
  const role = prose.match(/^[ \t]*(?:job title|position|role|title)[ \t]*:[ \t]*(.+)$/im)?.[1] ?? prose.match(ROLE)?.[0] ?? ''
  const location = prose.match(/^[ \t]*(?:job )?location[ \t]*:[ \t]*(.+)$/im)?.[1]
    ?? PLACES.filter(place => new RegExp(`\\b${place}\\b`, 'i').test(prose)).slice(0, 2).join(' / ')
  return { company: company(prose), role: role.trim(), location: location.trim(), url }
}
