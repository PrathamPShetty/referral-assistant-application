import type { Kind } from './message.ts'

export const CATEGORIES = {
  engineer: 'Engineer', recruiter: 'Recruiter', manager: 'Hiring manager', employee: 'Other employee',
} as const
export type Category = keyof typeof CATEGORIES

export const DEGREES = { first: '1st', second: '2nd', other: '3rd+' } as const
export type Degree = keyof typeof DEGREES

export const CONTACT_STATUS = {
  saved: 'Not contacted', requested: 'Connection sent', connected: 'Connected',
  asked: 'Message sent', replied: 'Replied', referred: 'Referred', declined: 'Declined',
} as const
export type ContactStatus = keyof typeof CONTACT_STATUS

export const JOB_STATUS = {
  saved: 'Saved', seeking: 'Seeking referral', referred: 'Referred', applied: 'Applied',
  interviewing: 'Interviewing', offer: 'Offer', closed: 'Closed',
} as const
export type JobStatus = keyof typeof JOB_STATUS

export interface JobDetails { company: string; role: string; location: string; url: string }
export interface Job extends JobDetails { id: string; status: JobStatus; createdAt: number }
/** A message drafted by the extension but not yet sent. The human still sends it. */
export interface MessageDraft { kind: Kind; text: string; createdAt: number }
export interface Contact {
  id: string; jobId: string; name: string; title: string; url: string
  degree: Degree; mutuals: number; alumni: boolean; known: boolean
  status: ContactStatus; lastContactAt: number | null; followUps: number; notes: string
  requestedAt: number | null; connectedAt: number | null; draft: MessageDraft | null
}
export interface Settings {
  name: string; skills: string; school: string; followUpDays: number; noteLimit: number
  provider: 'template' | 'gemini' | 'openai'; geminiModel: string; openaiModel: string
  linkedinRead: boolean; inviteCap: number
}
export interface Data { version: 2; jobs: Job[]; contacts: Contact[]; settings: Settings }

export const emptyData = (): Data => ({
  version: 2, jobs: [], contacts: [],
  settings: {
    name: '', skills: '', school: '', followUpDays: 5, noteLimit: 200,
    provider: 'template', geminiModel: 'gemini-3.8-flash', openaiModel: 'gpt-6-luna',
    linkedinRead: false, inviteCap: 80, // default matches queue.WEEKLY_INVITE_CAP
  },
})
