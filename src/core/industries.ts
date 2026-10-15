/**
 * Industries a person can choose to avoid. Each pattern is matched against the job title, company and
 * the opening of the description, so brand names (e.g. "Ritz-Carlton") count even when the title is generic.
 */
export const INDUSTRIES = [
  {
    id: 'hotels',
    re: /\b(hotels?|hospitality|housekeeping|ritz[- ]carlton|marriott|hilton|four seasons|sheraton|intercontinental|kempinski|mondrian|tivoli|fairmont|raffles|mandarin oriental|st\.? regis|accor|ihg|radisson|novotel|ibis|movenpick|mövenpick|shangri[- ]la|hyatt|w doha|banyan tree|anantara|jumeirah|rotana|millennium hotels|wyndham|crowne plaza|holiday inn|best western|le m[eé]ridien|westin|sofitel|pullman|swiss[oô]tel|kimpton|waldorf|conrad|park hyatt|habitas)\b|فندق|فنادق|ضيافة/i,
  },
  { id: 'resorts', re: /\b(resorts?|beach club|spa resort|banyan tree|anantara|zulal|sealine|six senses|wellness retreat)\b|منتجع|منتجعات/i },
  { id: 'restaurants', re: /\b(restaurants?|caf[eé]s?|coffee shop|barista|waiter|waitress|catering|kitchen|chef|f&b|food (and|&) beverage|bakery|fast food)\b|مطعم|مطاعم|مقهى|كافيه|تموين|ضيافة طعام/i },
  { id: 'construction', re: /\b(construction|contracting|civil works|site (engineer|supervisor)|foreman|scaffold|mep contractor|building works)\b|مقاولات|إنشاءات|انشاءات/i },
  { id: 'retail', re: /\b(retail|showroom|supermarket|hypermarket|shopping mall|cashier|merchandis(er|ing)|sales associate)\b|تجزئة|سوبرماركت|هايبر ماركت|كاشير/i },
  { id: 'healthcare', re: /\b(hospital|clinic|medical cent(er|re)|nurse|nursing|healthcare|patient)\b|مستشفى|عيادة|مركز طبي|تمريض/i },
  { id: 'callcenter', re: /\b(call cent(er|re)|contact cent(er|re)|telesales|telemarketing|bpo)\b|مركز اتصال|كول سنتر/i },
  { id: 'security', re: /\b(security guard|security officer|guarding|watchman|cctv operator)\b|حارس|حراسة|أمن وحماية/i },
  { id: 'cleaning', re: /\b(cleaner|cleaning|janitor|facility services|housekeeper)\b|تنظيف|نظافة|عامل نظافة/i },
  { id: 'oilgas', re: /\b(oil (and|&) gas|offshore|rig|onshore site|petrochemical|refinery)\b|نفط|غاز|بتروكيماويات|حقول/i },
  { id: 'driving', re: /\b(driver|delivery rider|courier|chauffeur)\b|سائق|توصيل|مندوب توصيل/i },
] as const;

export type IndustryId = (typeof INDUSTRIES)[number]['id'];

/** The first avoided industry this job belongs to, if any. */
export function avoidedIndustry(job: { title: string; company: string; description: string }, avoid: readonly string[] | undefined): IndustryId | undefined {
  if (!avoid?.length) return undefined;
  const text = `${job.title} ${job.company} ${job.description.slice(0, 500)}`;
  return INDUSTRIES.find((i) => avoid.includes(i.id) && i.re.test(text))?.id;
}
