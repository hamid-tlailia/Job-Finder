import type { ApplicationPackage, Channel, CvTemplate, Job, Lang, Profile, TailoredCv } from './types';
import { QATAR_CITIES, cityOf } from './qatar';

export function pickLanguage(job: Job, p: Profile): Lang {
  if (p.prefs.cvLanguage !== 'auto') return p.prefs.cvLanguage;
  return job.language === 'ar' ? 'ar' : 'en';
}

const SENIOR_TITLE = /\b(manager|head|director|chief|vp|vice president|general manager|gm|c[eofti]o|partner|principal|lead)\b|مدير|رئيس|نائب الرئيس|الرئيس التنفيذي/i;

/**
 * Classic (single-column ATS) is the market default; the executive layout is the norm for
 * managers and directors, so it is picked for senior targets unless the user fixed a choice.
 */
export function chooseTemplate(p: Profile, job: Job, pref: 'auto' | CvTemplate = 'auto'): CvTemplate {
  if (pref !== 'auto') return pref;
  const senior = p.prefs.seniority.some((s) => s === 'lead' || s === 'executive') || p.yearsExperience >= 12;
  return senior || SENIOR_TITLE.test(job.title) ? 'executive' : 'classic';
}

export function pickChannel(job: Job): { channel: Channel; target: string } {
  if (job.contactEmail) return { channel: 'email', target: job.contactEmail };
  if (job.contactPhone) return { channel: 'whatsapp', target: job.contactPhone };
  return { channel: 'website', target: job.applyUrl ?? job.url };
}

const VISA = {
  en: { citizen: 'Qatari national', resident_transferable: 'Qatar resident, transferable visa', resident_noc: 'Qatar resident, NOC available', family_visa: 'Family visa (no sponsorship needed)', need_sponsorship: 'Requires visa sponsorship' },
  ar: { citizen: 'مواطن قطري', resident_transferable: 'مقيم في قطر، إقامة قابلة للتحويل', resident_noc: 'مقيم في قطر، يتوفر NOC', family_visa: 'إقامة عائلية (لا يحتاج كفالة)', need_sponsorship: 'يحتاج كفالة وتأشيرة' },
};
const AVAIL = {
  en: { immediate: 'Immediate', two_weeks: 'Within 2 weeks', one_month: 'Within 1 month', two_months_plus: 'After notice period' },
  ar: { immediate: 'فوري', two_weeks: 'خلال أسبوعين', one_month: 'خلال شهر', two_months_plus: 'بعد فترة الإشعار' },
};

/** Nationalities common in Qatar, so the CV prints them in its own language (no mixed Arabic/English line). */
const NATIONALITIES: [string, string, string][] = [
  ['Tunisian', 'تونسي', 'تونسية'], ['Egyptian', 'مصري', 'مصرية'], ['Moroccan', 'مغربي', 'مغربية'], ['Algerian', 'جزائري', 'جزائرية'],
  ['Jordanian', 'أردني', 'أردنية'], ['Lebanese', 'لبناني', 'لبنانية'], ['Syrian', 'سوري', 'سورية'], ['Palestinian', 'فلسطيني', 'فلسطينية'],
  ['Sudanese', 'سوداني', 'سودانية'], ['Iraqi', 'عراقي', 'عراقية'], ['Yemeni', 'يمني', 'يمنية'], ['Libyan', 'ليبي', 'ليبية'],
  ['Qatari', 'قطري', 'قطرية'], ['Saudi', 'سعودي', 'سعودية'], ['Emirati', 'إماراتي', 'إماراتية'], ['Kuwaiti', 'كويتي', 'كويتية'],
  ['Omani', 'عماني', 'عمانية'], ['Bahraini', 'بحريني', 'بحرينية'], ['Mauritanian', 'موريتاني', 'موريتانية'], ['Somali', 'صومالي', 'صومالية'],
  ['Indian', 'هندي', 'هندية'], ['Pakistani', 'باكستاني', 'باكستانية'], ['Filipino', 'فلبيني', 'فلبينية'], ['Bangladeshi', 'بنغلاديشي', 'بنغلاديشية'],
  ['Nepali', 'نيبالي', 'نيبالية'], ['Sri Lankan', 'سريلانكي', 'سريلانكية'], ['Kenyan', 'كيني', 'كينية'], ['Turkish', 'تركي', 'تركية'],
  ['Iranian', 'إيراني', 'إيرانية'], ['British', 'بريطاني', 'بريطانية'], ['French', 'فرنسي', 'فرنسية'], ['American', 'أمريكي', 'أمريكية'],
];

export function nationalityIn(value: string, lang: Lang): string {
  const v = value.trim().replace(/^ال/, '');
  const row = NATIONALITIES.find(([en, m, f]) => en.toLowerCase() === v.toLowerCase() || m === v || f === v || m.replace(/^أ|^إ/, 'ا') === v || f.replace(/^أ|^إ/, 'ا') === v);
  if (!row) return value;
  return lang === 'en' ? row[0] : row[1];
}

/** Personal details Gulf employers look for at the top of a CV. */
export function personalLine(p: Profile, lang: Lang): string[] {
  const ar = lang === 'ar';
  return [
    p.nationality && `${ar ? 'الجنسية' : 'Nationality'}: ${nationalityIn(p.nationality, lang)}`,
    `${ar ? 'الإقامة' : 'Visa'}: ${VISA[lang][p.prefs.visaStatus]}`,
    `${ar ? 'متاح للعمل' : 'Availability'}: ${AVAIL[lang][p.prefs.availability]}`,
  ].filter(Boolean) as string[];
}

export function contactLine(p: Profile, lang: Lang): string[] {
  const city = cityOf(p.city) ?? QATAR_CITIES.find((c) => c.id === p.city);
  return [p.phone, p.email, city ? (lang === 'ar' ? `${city.ar}، قطر` : `${city.en}, Qatar`) : '', p.linkedin.replace(/^https?:\/\/(www\.)?/, '')].filter(Boolean);
}

function role(p: Profile): string {
  return p.headline || p.targetTitles[0] || '';
}

function experiencePhrase(p: Profile, lang: Lang): string {
  if (!p.yearsExperience) return '';
  return lang === 'ar' ? ` بخبرة ${p.yearsExperience} سنوات` : ` with ${p.yearsExperience} years of experience`;
}

function defaultSummary(p: Profile, lang: Lang): string {
  const skills = p.skills.slice(0, 4).join(lang === 'ar' ? '، ' : ', ');
  if (lang === 'ar') return `${role(p) || 'محترف'}${experiencePhrase(p, lang)}${skills ? `، متمكن من ${skills}` : ''}. أسعى للانضمام إلى فريق يقدّر الدقة والالتزام والنتائج.`;
  return `${role(p) || 'Professional'}${experiencePhrase(p, lang)}${skills ? `, skilled in ${skills}` : ''}. Seeking to join a team that values accuracy, commitment and results.`;
}

export function baseCv(p: Profile, job: Job, lang: Lang): TailoredCv {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const skills = [...p.skills].sort((a, b) => Number(text.includes(b.toLowerCase())) - Number(text.includes(a.toLowerCase())));
  return {
    language: lang,
    name: p.fullName,
    headline: role(p) || job.title,
    contact: contactLine(p, lang),
    summary: p.summary || defaultSummary(p, lang),
    personal: personalLine(p, lang),
    skills: skills.slice(0, 14),
    highlights: p.experience.flatMap((e) => e.bullets.slice(0, 1)).filter((b) => b.trim()).slice(0, 4),
    experience: p.experience,
    education: p.education,
    certifications: p.certifications,
    languages: p.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)),
  };
}

/** Deterministic package used when no AI key is configured. */
export function templatePackage(p: Profile, job: Job, templatePref: 'auto' | CvTemplate = 'auto'): ApplicationPackage {
  const lang = pickLanguage(job, p);
  const { channel, target } = pickChannel(job);
  const company = job.company || (lang === 'ar' ? 'فريقكم' : 'your team');
  const top = p.skills.slice(0, 4).join(lang === 'ar' ? '، ' : ', ');
  const me = role(p);
  const exp = experiencePhrase(p, lang);
  const coverLetter =
    lang === 'ar'
      ? `السادة ${company} المحترمين،\n\nتحية طيبة وبعد،\n\nأتقدم بطلبي لشغل وظيفة "${job.title}" المعلن عنها. أعمل ${me ? `في مجال ${me}` : 'بشغف واحترافية'}${exp}${top ? `، ومتمكن من ${top}` : ''}.\n\nأرى أن خبرتي تتوافق مع متطلبات الوظيفة، وأنا متحمس للمساهمة في نجاح ${company}. أنا مقيم في قطر ومتاح للبدء ${availabilityAr(p)}.\n\nمرفق سيرتي الذاتية، وأتطلع لفرصة مناقشة كيف يمكنني إضافة قيمة لفريقكم.\n\nمع خالص التقدير،\n${p.fullName}\n${p.phone}`
      : `Dear Hiring Team at ${company},\n\nI am writing to apply for the ${job.title} position. I am ${me ? `a ${me}` : 'a dedicated professional'}${exp}${top ? `, with strengths in ${top}` : ''}.\n\nMy background aligns closely with the requirements of this role, and I am excited about the opportunity to contribute to ${company}. I am based in Qatar and available to start ${availabilityEn(p)}.\n\nPlease find my CV attached. I would welcome the chance to discuss how I can add value to your team.\n\nKind regards,\n${p.fullName}\n${p.phone}`;
  const emailSubject = lang === 'ar' ? `طلب توظيف: ${job.title} - ${p.fullName}` : `Application: ${job.title} - ${p.fullName}`;
  const whatsappMessage =
    lang === 'ar'
      ? `السلام عليكم، أنا ${p.fullName}${me ? `، ${me}` : ''}${exp}. أود التقدم لوظيفة "${job.title}". يسعدني إرسال سيرتي الذاتية. شكراً لكم.`
      : `Hello, I'm ${p.fullName}${me ? `, ${me}` : ''}${exp}. I'd like to apply for the "${job.title}" role and can share my CV right away. Thank you!`;
  return {
    language: lang,
    cv: baseCv(p, job, lang),
    coverLetter,
    emailSubject,
    emailBody: coverLetter,
    whatsappMessage,
    formAnswers: [],
    atsKeywords: p.skills.filter((s) => job.description.toLowerCase().includes(s.toLowerCase())),
    channel,
    target,
    template: chooseTemplate(p, job, templatePref),
    by: 'local',
    createdAt: new Date().toISOString(),
  };
}

function availabilityEn(p: Profile): string {
  return { immediate: 'immediately', two_weeks: 'within two weeks', one_month: 'within one month', two_months_plus: 'after my notice period' }[p.prefs.availability];
}
function availabilityAr(p: Profile): string {
  return { immediate: 'فوراً', two_weeks: 'خلال أسبوعين', one_month: 'خلال شهر', two_months_plus: 'بعد انتهاء فترة الإشعار' }[p.prefs.availability];
}

/** Removes the long dashes AI text is known for: " — " becomes a comma (or " | " in titles). */
export function plainDashes(text: string, title = false): string {
  return text.replace(/\s+[—–]\s+/g, title ? ' | ' : ', ').replace(/—/g, ', ');
}
