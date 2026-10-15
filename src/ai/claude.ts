import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import type { Analysis, ApplicationPackage, CvTemplate, Job, Lang, Profile, TailoredCv } from '../core/types';
import { chooseTemplate, contactLine, personalLine, pickChannel, pickLanguage } from '../core/template';
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
  const { cvText, tracks: _tracks, ...rest } = p;
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
  highlights: z.array(z.string()).describe('3-4 career highlights: the candidate\'s strongest achievements most relevant to this job, one line each, quantified where the data supports it'),
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

export async function generatePackage(cfg: AiConfig, p: Profile, job: Job, analysis?: Analysis, templatePref: 'auto' | CvTemplate = 'auto'): Promise<ApplicationPackage> {
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
      highlights: r.highlights,
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
    template: chooseTemplate(p, job, templatePref),
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

const SuggestionSchema = z.object({
  section: z.enum(['basics', 'goals', 'experience', 'education', 'languages']).describe('profile tab the suggestion belongs to'),
  field: z.enum(['fullName', 'email', 'phone', 'nationality', 'linkedin', 'headline', 'summary', 'targetTitles', 'skills', 'yearsExperience', 'experience', 'education', 'certifications', 'languages']),
  kind: z.enum(['missing', 'different', 'improve']).describe('missing: in the CV but not in the profile; different: both have it but they disagree; improve: the profile entry is much weaker than the CV'),
  message: z.string().describe('one short sentence for the user in the UI language explaining the gap'),
  text: z.string().nullable().describe('new value for single text fields (fullName, email, phone, nationality, linkedin, headline, summary)'),
  items: z.array(z.string()).nullable().describe('items to ADD for list fields (targetTitles, skills, certifications) — only ones not already in the profile'),
  years: z.number().nullable().describe('new value for yearsExperience'),
  experience: ExperienceSchema.nullable().describe('the experience entry from the CV for field experience'),
  education: z.object({ degree: z.string(), school: z.string(), year: z.string() }).nullable(),
  language: z.object({ name: z.string(), level: z.string() }).nullable(),
  replaceIndex: z.number().nullable().describe('for different/improve on experience, education or languages: index of the profile entry to replace; null to add a new entry'),
});

export type ProfileSuggestion = z.infer<typeof SuggestionSchema> & { id: string };

const ReviewSchema = z.object({ suggestions: z.array(SuggestionSchema) });

/** Compares the uploaded CV with the profile and proposes concrete, ready-to-apply fixes. */
export async function reviewProfile(cfg: AiConfig, p: Profile, uiLang: Lang, cvOverride?: string): Promise<ProfileSuggestion[]> {
  const { cvText: ownCv, prefs: _prefs, tracks: _tracks, ...profile } = p;
  const cvText = cvOverride ?? ownCv;
  const r = await structured(
    cfg,
    ReviewSchema,
    'low',
    `UI language: ${uiLang === 'ar' ? 'Arabic' : 'English'}.
Compare the candidate's CV with their app profile. List every fact present in the CV that is missing from the profile, contradicts it, or is clearly richer in the CV (e.g. a job with achievements in the CV but only a title in the profile). Also suggest 2-4 target job titles and the key skills if the profile has few.
Rules: take values only from the CV — never invent anything. Skip anything already equivalent in the profile (ignore formatting differences, e.g. phone spacing or +974 prefix). Put the value in the slot that matches the field and leave other slots null. Keep messages short. Return an empty list if the profile already reflects the CV.

<cv>
${cvText.slice(0, 30000)}
</cv>

<profile>
${JSON.stringify(profile, null, 1)}
</profile>`,
    12000,
  );
  return r.suggestions.map((s, i) => ({ ...s, id: `${s.field}:${i}:${(s.text ?? s.items?.join(',') ?? s.experience?.company ?? s.education?.degree ?? s.language?.name ?? String(s.years ?? '')).slice(0, 40)}` }));
}

const TrackSchema = z.object({
  name: z.string().describe('short field name in the UI language, e.g. "Sales", "Reception", "Pharmacy"'),
  targetTitles: z.array(z.string()).describe('2-4 job titles employers in Qatar use for this field, in English'),
  headline: z.string().describe('professional title for CVs in this field'),
  summary: z.string().describe('3-4 line professional summary for this field, in the language of the CV'),
  skills: z.array(z.string()).describe('8-12 skills from the candidate data relevant to this field'),
  keywords: z.array(z.string()).describe('6-10 extra job-board search keywords for this field in Qatar: common synonyms of the titles in English plus their Arabic equivalents (e.g. "Front Desk Agent", "Guest Relations", "موظف استقبال")'),
});

export type TrackDraft = z.infer<typeof TrackSchema>;

/** Groups the candidate's history into distinct career fields (up to `max`). */
export async function suggestTracks(cfg: AiConfig, p: Profile, uiLang: Lang, max: number): Promise<TrackDraft[]> {
  const r = await structured(
    cfg,
    z.object({ tracks: z.array(TrackSchema) }),
    'low',
    `UI language: ${uiLang === 'ar' ? 'Arabic' : 'English'}.
This candidate may have worked in several unrelated fields (for example sales, reception and pharmacy). Identify the distinct career fields they can realistically apply to in Qatar, based only on their real experience, education and skills — at most ${max}. Return one track per field; if they clearly work in a single field return just one.
Existing tracks (do not duplicate): ${JSON.stringify((p.tracks ?? []).map((t) => t.name))}

<candidate>
${profileBrief({ ...p, tracks: [] })}
</candidate>`,
    8000,
  );
  return r.tracks.slice(0, max);
}

/** Reads the CV uploaded for one track into that track's titles, pitch and skills. */
export async function parseTrackCv(cfg: AiConfig, cvText: string, uiLang: Lang): Promise<TrackDraft> {
  return structured(
    cfg,
    TrackSchema,
    'low',
    `UI language for the name: ${uiLang === 'ar' ? 'Arabic' : 'English'}. This CV targets one career field. Extract that field's name, target titles, headline, summary and skills — only from the CV.\n\n<cv>\n${cvText.slice(0, 30000)}\n</cv>`,
    6000,
  );
}

const PolishTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  headline: z.string(),
  summary: z.string(),
  targetTitles: z.array(z.string()),
  skills: z.array(z.string()),
  keywords: z.array(z.string()),
});

const PolishSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  targetTitles: z.array(z.string()),
  skills: z.array(z.string()),
  experience: z.array(ExperienceSchema),
  education: z.array(z.object({ degree: z.string(), school: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  tracks: z.array(PolishTrackSchema).describe('every existing track, same ids, polished'),
  changes: z.array(z.string()).describe('short list, in the UI language, of what was improved'),
});

export type PolishResult = z.infer<typeof PolishSchema>;

/** One-tap clean-up of the whole profile and its tracks: consistent, recruiter-ready, nothing invented. */
export async function polishProfile(cfg: AiConfig, p: Profile, uiLang: Lang): Promise<PolishResult> {
  const { cvText: _cv, prefs: _prefs, ...rest } = p;
  return structured(
    cfg,
    PolishSchema,
    'medium',
    `UI language for "changes": ${uiLang === 'ar' ? 'Arabic' : 'English'}.
Polish this job-seeker profile so it reads like a professional, recruiter-ready record for the Qatar market. Return every field, improved:
- Fix spelling, grammar and capitalisation; use standard industry titles; keep each text in its current language.
- Dates as "Mon YYYY" (Arabic month names for Arabic entries); reverse chronological experience; end empty when current.
- Experience bullets: start with an action verb, state scope or results only when the data supports it, max ~25 words, 2-5 per role.
- Skills: remove duplicates and near-duplicates, use canonical names (e.g. "Microsoft Excel"), drop soft clichés, most marketable first, max 20.
- Target titles: 2-5 real job-board titles. Languages: standard levels (Native, Fluent, Professional, Basic).
- For each track: sharpen its headline, summary, titles and skills for that field, and give 6-10 search keywords (English synonyms + Arabic equivalents).
- NEVER invent employers, dates, numbers, degrees, certifications or skills. When unsure, keep the original wording.
List the main improvements in "changes".

<profile>
${JSON.stringify(rest, null, 1)}
</profile>`,
    20000,
  );
}

const GenericCvSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  skills: z.array(z.string()),
  skillGroups: z.array(z.object({ name: z.string(), items: z.array(z.string()) })),
  highlights: z.array(z.string()),
  experience: z.array(ExperienceSchema),
  education: z.array(z.object({ degree: z.string(), school: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
});

/** A ready-to-send CV for a career field (not tied to one posting), written in the requested language. */
export async function generateFieldCv(cfg: AiConfig, p: Profile, lang: Lang): Promise<Omit<TailoredCv, 'language' | 'name' | 'contact' | 'personal'>> {
  return structured(
    cfg,
    GenericCvSchema,
    'medium',
    `Write a complete, ATS-friendly CV for this candidate targeting the field described by their headline and target titles (${p.targetTitles.slice(0, 4).join(', ')}), in ${lang === 'ar' ? 'Modern Standard Arabic' : 'professional English'}.
Lead with the experience and skills most relevant to that field; keep other roles brief so there are no gaps. Skills grouped into 2-4 categories; 3-4 highlights. Dates as "Mon YYYY". Never invent facts.

<candidate>
${profileBrief(p)}
</candidate>`,
    12000,
  );
}
