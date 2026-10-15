import type { ApplicationPackage, Channel, Job, Lang, Profile, TailoredCv } from './types';
import { cityOf } from './qatar';

export function pickLanguage(job: Job, p: Profile): Lang {
  if (p.prefs.cvLanguage !== 'auto') return p.prefs.cvLanguage;
  return job.language === 'ar' ? 'ar' : 'en';
}

export function pickChannel(job: Job): { channel: Channel; target: string } {
  if (job.contactEmail) return { channel: 'email', target: job.contactEmail };
  if (job.contactPhone) return { channel: 'whatsapp', target: job.contactPhone };
  return { channel: 'website', target: job.applyUrl ?? job.url };
}

function contactLine(p: Profile, lang: Lang): string[] {
  const city = cityOf(p.city) ?? undefined;
  return [p.phone, p.email, p.linkedin, city ? (lang === 'ar' ? `${city.ar}، قطر` : `${city.en}, Qatar`) : ''].filter(Boolean);
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
    skills: skills.slice(0, 14),
    experience: p.experience,
    education: p.education,
    certifications: p.certifications,
    languages: p.languages.map((l) => `${l.name} — ${l.level}`),
  };
}

/** Deterministic package used when no AI key is configured. */
export function templatePackage(p: Profile, job: Job): ApplicationPackage {
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
  const emailSubject = lang === 'ar' ? `طلب توظيف: ${job.title} — ${p.fullName}` : `Application: ${job.title} — ${p.fullName}`;
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
