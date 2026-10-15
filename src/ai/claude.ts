import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import type { Analysis, ApplicationPackage, Job, Lang, Profile } from '../core/types';
import { contactLine, personalLine, pickChannel, pickLanguage } from '../core/template';
import { cityOf } from '../core/qatar';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'best' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'balanced' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'cheapest' },
] as const;

export interface AiConfig {
  apiKey: string;
  model: string;
}

function client(cfg: AiConfig): Anthropic {
  return new Anthropic({ apiKey: cfg.apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 180_000 });
}

const SYSTEM = `You are a senior recruitment consultant and career coach specialised in the Qatar job market (Doha, Lusail, Al Rayyan, Ras Laffan, Mesaieed...). You know local hiring norms: Qatari nationals priority (Qatarization), visa sponsorship, NOC and transferable visas, QID, typical QAR salary ranges, and that most private-sector roles hire in English while government and many local firms prefer Arabic.
Absolute rule: never invent experience, employers, degrees, certifications, numbers or skills the candidate does not have. You may reorder, rephrase, emphasise and quantify only what the candidate's data supports.`;

async function structured<T extends z.ZodType>(cfg: AiConfig, schema: T, effort: 'low' | 'medium' | 'high', prompt: string, maxTokens: number): Promise<z.infer<T>> {
  const res = await client(cfg).beta.messages.parse({
    model: cfg.model,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: 'user', content: prompt }],
  });
  if (res.stop_reason === 'refusal') throw new Error('The model declined this request.');
  if (res.stop_reason === 'max_tokens') throw new Error('The response was cut off; try again.');
  if (!res.parsed_output) throw new Error('Could not read the model response.');
  return res.parsed_output as z.infer<T>;
}

function profileBrief(p: Profile): string {
  const { cvText, ...rest } = p;
  return JSON.stringify({ ...rest, cityName: cityOf(p.city)?.en ?? p.city, cvText: cvText.slice(0, 12000) }, null, 1);
}

function jobBrief(j: Job): string {
  return JSON.stringify(
    {
      title: j.title,
      company: j.company,
      location: j.location,
      employmentType: j.employmentType,
      workplace: j.workplace,
      salary: j.salary,
      experience: j.experience,
      postedAt: j.postedAt,
      contactEmail: j.contactEmail,
      contactPhone: j.contactPhone,
      description: j.description.slice(0, 14000),
    },
    null,
    1,
  );
}

const AnalysisSchema = z.object({
  score: z.number().describe('0-100 overall fit, honest and calibrated'),
  verdict: z.enum(['excellent', 'good', 'fair', 'weak']),
  reasons: z.array(z.string()).describe('3-5 short reasons the candidate fits, in the UI language'),
  gaps: z.array(z.string()).describe('0-4 short concrete gaps or risks (visa, language, years, location, missing skill), in the UI language'),
  keyRequirements: z.array(z.string()).describe('the 4-8 most important requirements from the posting'),
  summary: z.string().describe('two sentences in the UI language: what the role is and whether to apply'),
  jobLanguage: z.enum(['ar', 'en']).describe('the language the employer expects the application in'),
  contactEmail: z.string().describe('email to send the application to if the posting gives one, else empty'),
  whatsappNumber: z.string().describe('WhatsApp number in +974 format if the posting asks to apply by WhatsApp, else empty'),
  applicationInstructions: z.string().describe('special instructions such as a required email subject or reference code, else empty'),
});

export async function analyzeJob(cfg: AiConfig, p: Profile, job: Job, uiLang: Lang): Promise<{ analysis: Analysis; job: Partial<Job> }> {
  const r = await structured(
    cfg,
    AnalysisSchema,
    'low',
    `UI language: ${uiLang === 'ar' ? 'Arabic' : 'English'}.
Score how well this Qatar job fits the candidate. Weigh: role/title fit, hard skills, years and seniority, the candidate's job-type, workplace, distance and language preferences, salary floor (QAR), and visa status vs. any nationality/visa restriction in the posting. Penalise hard blockers heavily.

<candidate>
${profileBrief(p)}
</candidate>

<job>
${jobBrief(job)}
</job>`,
    4000,
  );
  return {
    analysis: {
      score: Math.round(Math.max(0, Math.min(100, r.score))),
      verdict: r.verdict,
      reasons: r.reasons,
      gaps: r.gaps,
      keyRequirements: r.keyRequirements,
      summary: r.summary + (r.applicationInstructions ? `\n${r.applicationInstructions}` : ''),
      language: r.jobLanguage,
      by: 'ai',
    },
    job: {
      contactEmail: job.contactEmail || r.contactEmail || undefined,
      contactPhone: job.contactPhone || r.whatsappNumber || undefined,
    },
  };
}

const ExperienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  start: z.string(),
  end: z.string(),
  bullets: z.array(z.string()),
});

const PackageSchema = z.object({
  headline: z.string(),
  summary: z.string().describe('3-4 line professional summary tailored to this job'),
  skills: z.array(z.string()).describe('10-16 skills, most relevant to the job first, using the posting wording where truthful'),
  skillGroups: z.array(z.object({ name: z.string(), items: z.array(z.string()) })).describe('the same skills organised into 2-4 categories such as Technical, Software & Tools, Professional, each with 3-6 items'),
  experience: z.array(ExperienceSchema).describe('the candidate roles in reverse chronological order; dates as "Mon YYYY" (or the Arabic month name), end empty if current; 3-5 bullets each, most relevant first, each starting with a strong action verb and stating scope or a measurable result when the candidate data supports it, max ~25 words'),
  education: z.array(z.object({ degree: z.string(), school: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  coverLetter: z.string().describe('250-350 words, specific to the company and role, no placeholders'),
  emailSubject: z.string(),
  emailBody: z.string().describe('short email (90-140 words) to send with the CV attached'),
  whatsappMessage: z.string().describe('polite WhatsApp message under 70 words'),
  formAnswers: z.array(z.object({ question: z.string(), answer: z.string() })).describe('answers to the screening questions this employer will likely ask: motivation, expected salary in QAR, notice period, visa/QID status, relevant experience'),
  atsKeywords: z.array(z.string()).describe('keywords from the posting now covered by the CV'),
});

export async function generatePackage(cfg: AiConfig, p: Profile, job: Job, analysis?: Analysis): Promise<ApplicationPackage> {
  const lang = p.prefs.cvLanguage !== 'auto' ? p.prefs.cvLanguage : analysis?.language ?? pickLanguage(job, p);
  const r = await structured(
    cfg,
    PackageSchema,
    'medium',
    `Write the complete application for this job in ${lang === 'ar' ? 'Modern Standard Arabic (formal, professional)' : 'professional British/International English'}.
- Tailor the CV to pass ATS screening for this exact posting: mirror its keywords where truthful, lead with the most relevant achievements, keep it to what fits on 1-2 pages.
- CV style: concise, factual, recruiter-friendly. No first person ("I"), no clichés ("hard-working", "team player"), no photo-style personal data beyond what is given. Summary: 3-4 lines stating title, years of experience, core expertise and the value brought to this employer.
- The cover letter must name the company and role, connect 2-3 concrete achievements to the key requirements, and mention availability and visa status positively when relevant.
- Sign everything with the candidate's real name and phone. Never use placeholders like [Company].
${analysis?.keyRequirements.length ? `Key requirements: ${analysis.keyRequirements.join('; ')}` : ''}

<candidate>
${profileBrief(p)}
</candidate>

<job>
${jobBrief(job)}
</job>`,
    16000,
  );
  const { channel, target } = pickChannel(job);
  return {
    language: lang,
    cv: {
      language: lang,
      name: p.fullName,
      headline: r.headline,
      contact: contactLine(p, lang),
      summary: r.summary,
      personal: personalLine(p, lang),
      skills: r.skills,
      skillGroups: r.skillGroups.filter((g) => g.items.length),
      experience: r.experience,
      education: r.education,
      certifications: r.certifications,
      languages: r.languages,
    },
    coverLetter: r.coverLetter,
    emailSubject: r.emailSubject,
    emailBody: r.emailBody,
    whatsappMessage: r.whatsappMessage,
    formAnswers: r.formAnswers,
    atsKeywords: r.atsKeywords,
    channel,
    target,
    by: 'ai',
    createdAt: new Date().toISOString(),
  };
}

const CvImportSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  linkedin: z.string(),
  nationality: z.string(),
  headline: z.string(),
  summary: z.string(),
  targetTitles: z.array(z.string()).describe('2-4 job titles this person should search for in Qatar'),
  skills: z.array(z.string()),
  yearsExperience: z.number(),
  experience: z.array(ExperienceSchema),
  education: z.array(z.object({ degree: z.string(), school: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
});

export type CvImport = z.infer<typeof CvImportSchema>;

export async function parseCv(cfg: AiConfig, cvText: string): Promise<CvImport> {
  return structured(cfg, CvImportSchema, 'low', `Extract this CV into structured data. Keep the CV's own language for free text. Use empty strings for unknown fields.\n\n<cv>\n${cvText.slice(0, 40000)}\n</cv>`, 12000);
}

export async function testKey(cfg: AiConfig): Promise<void> {
  await client(cfg).models.retrieve(cfg.model);
}
