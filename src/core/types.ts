export type Lang = 'ar' | 'en';
export type JobType = 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship' | 'freelance';
export type Workplace = 'onsite' | 'hybrid' | 'remote';
export type DistancePref = 'any' | 'near' | 'same_city';
export type VisaStatus = 'citizen' | 'resident_transferable' | 'resident_noc' | 'family_visa' | 'need_sponsorship';
export type Availability = 'immediate' | 'two_weeks' | 'one_month' | 'two_months_plus';
export type Seniority = 'entry' | 'junior' | 'mid' | 'senior' | 'lead' | 'executive';

export interface ExperienceItem {
  title: string;
  company: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  school: string;
  year: string;
}

export interface SpokenLanguage {
  name: string;
  level: string;
}

export interface Preferences {
  country: string;
  jobTypes: JobType[];
  workplaces: Workplace[];
  jobLanguages: Lang[];
  cvLanguage: 'auto' | Lang;
  distance: DistancePref;
  maxKm: number;
  salaryMinQar: number;
  visaStatus: VisaStatus;
  availability: Availability;
  seniority: Seniority[];
  industries: string[];
  excludeKeywords: string[];
  minScore: number;
}

export interface Profile {
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  nationality: string;
  city: string;
  linkedin: string;
  headline: string;
  summary: string;
  targetTitles: string[];
  skills: string[];
  yearsExperience: number;
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: string[];
  languages: SpokenLanguage[];
  cvText: string;
  prefs: Preferences;
}

export interface Job {
  id: string;
  source: string;
  sourceLabel: string;
  title: string;
  company: string;
  logo?: string;
  location: string;
  city?: string;
  url: string;
  applyUrl?: string;
  description: string;
  postedAt?: string;
  employmentType?: string;
  workplace?: Workplace;
  salary?: string;
  contactEmail?: string;
  contactPhone?: string;
  language?: Lang;
  experience?: string;
  needsDetail?: boolean;
  fetchedAt: string;
}

export interface Analysis {
  score: number;
  verdict: 'excellent' | 'good' | 'fair' | 'weak';
  reasons: string[];
  gaps: string[];
  keyRequirements: string[];
  summary: string;
  language: Lang;
  by: 'ai' | 'local';
}

export interface TailoredCv {
  language: Lang;
  name: string;
  headline: string;
  contact: string[];
  summary: string;
  /** e.g. "Nationality: Egyptian", "Visa: Transferable" — expected on Gulf CVs. */
  personal?: string[];
  skills: string[];
  /** Skills organised by category; when present the PDF prints these instead of the flat list. */
  skillGroups?: { name: string; items: string[] }[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: string[];
  languages: string[];
}

export type Channel = 'email' | 'whatsapp' | 'website';

export interface ApplicationPackage {
  language: Lang;
  cv: TailoredCv;
  coverLetter: string;
  emailSubject: string;
  emailBody: string;
  whatsappMessage: string;
  formAnswers: { question: string; answer: string }[];
  atsKeywords: string[];
  channel: Channel;
  target: string;
  by: 'ai' | 'local';
  createdAt: string;
}

export type MatchStatus = 'new' | 'preparing' | 'ready' | 'applied' | 'saved' | 'dismissed' | 'interview' | 'offer' | 'rejected';

export interface MatchRecord {
  jobId: string;
  localScore: number;
  analysis?: Analysis;
  pkg?: ApplicationPackage;
  status: MatchStatus;
  seen: boolean;
  appliedAt?: string;
  appliedVia?: Channel;
  notes?: string;
  error?: string;
  updatedAt: string;
}

export interface SourceContext {
  queries: string[];
  profile: Profile;
  keys: { jooble?: string; serpapi?: string };
  fetchText: (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<string>;
}

export interface JobSource {
  id: string;
  label: string;
  needsKey?: 'jooble' | 'serpapi';
  remoteOnly?: boolean;
  search: (ctx: SourceContext) => Promise<Job[]>;
  detail?: (job: Job, ctx: SourceContext) => Promise<Partial<Job>>;
}
