export interface City {
  id: string;
  en: string;
  ar: string;
  lat: number;
  lng: number;
  aliases: string[];
}

export const QATAR_CITIES: City[] = [
  { id: 'doha', en: 'Doha', ar: 'الدوحة', lat: 25.2854, lng: 51.531, aliases: ['doha', 'الدوحة', 'west bay', 'msheireb', 'al sadd', 'old airport', 'bin mahmoud', 'najma', 'mansoura'] },
  { id: 'lusail', en: 'Lusail', ar: 'لوسيل', lat: 25.4285, lng: 51.4904, aliases: ['lusail', 'لوسيل', 'the pearl', 'pearl', 'west bay lagoon'] },
  { id: 'rayyan', en: 'Al Rayyan', ar: 'الريان', lat: 25.2919, lng: 51.4244, aliases: ['rayyan', 'الريان', 'education city', 'gharafa', 'aspire', 'muaither'] },
  { id: 'wakrah', en: 'Al Wakrah', ar: 'الوكرة', lat: 25.1715, lng: 51.6034, aliases: ['wakrah', 'wakra', 'الوكرة', 'barwa'] },
  { id: 'wukair', en: 'Al Wukair', ar: 'الوكير', lat: 25.1503, lng: 51.535, aliases: ['wukair', 'الوكير'] },
  { id: 'industrial', en: 'Industrial Area', ar: 'المنطقة الصناعية', lat: 25.2003, lng: 51.4295, aliases: ['industrial area', 'industrial', 'المنطقة الصناعية'] },
  { id: 'umm_salal', en: 'Umm Salal', ar: 'أم صلال', lat: 25.4152, lng: 51.4065, aliases: ['umm salal', 'أم صلال'] },
  { id: 'khor', en: 'Al Khor', ar: 'الخور', lat: 25.6839, lng: 51.5058, aliases: ['al khor', 'khor', 'الخور'] },
  { id: 'ras_laffan', en: 'Ras Laffan', ar: 'راس لفان', lat: 25.9081, lng: 51.5407, aliases: ['ras laffan', 'راس لفان', 'رأس لفان'] },
  { id: 'mesaieed', en: 'Mesaieed', ar: 'مسيعيد', lat: 24.9909, lng: 51.5493, aliases: ['mesaieed', 'mesaiid', 'umm said', 'مسيعيد'] },
  { id: 'dukhan', en: 'Dukhan', ar: 'دخان', lat: 25.4248, lng: 50.7826, aliases: ['dukhan', 'دخان'] },
  { id: 'shamal', en: 'Al Shamal', ar: 'الشمال', lat: 26.1293, lng: 51.2009, aliases: ['shamal', 'ruwais', 'الشمال'] },
  { id: 'shahaniya', en: 'Al Shahaniya', ar: 'الشحانية', lat: 25.371, lng: 51.211, aliases: ['shahaniya', 'الشحانية'] },
];

export const COUNTRIES = [
  { id: 'QA', en: 'Qatar', ar: 'قطر', flag: '🇶🇦', enabled: true },
  { id: 'AE', en: 'UAE', ar: 'الإمارات', flag: '🇦🇪', enabled: false },
  { id: 'SA', en: 'Saudi Arabia', ar: 'السعودية', flag: '🇸🇦', enabled: false },
  { id: 'KW', en: 'Kuwait', ar: 'الكويت', flag: '🇰🇼', enabled: false },
  { id: 'OM', en: 'Oman', ar: 'عُمان', flag: '🇴🇲', enabled: false },
  { id: 'BH', en: 'Bahrain', ar: 'البحرين', flag: '🇧🇭', enabled: false },
];

export function cityOf(location: string): City | undefined {
  const l = location.toLowerCase();
  return QATAR_CITIES.find((c) => c.aliases.some((a) => l.includes(a)));
}

export function distanceKm(a: City, b: City): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isInQatar(location: string): boolean {
  const l = location.toLowerCase();
  return /qatar|قطر|doha|الدوحة/.test(l) || !!cityOf(location);
}
