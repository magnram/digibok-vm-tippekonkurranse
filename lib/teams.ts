// Maps Norwegian team names to ISO codes (for flags via flagcdn) and English
// names (for matching the football-data.org API feed).
export const TEAMS: Record<string, { code: string; en: string[] }> = {
  Mexico: { code: "mx", en: ["Mexico"] },
  "Sør-Afrika": { code: "za", en: ["South Africa"] },
  "Sør-Korea": { code: "kr", en: ["Korea Republic", "South Korea"] },
  Tsjekkia: { code: "cz", en: ["Czechia", "Czech Republic"] },
  Canada: { code: "ca", en: ["Canada"] },
  Qatar: { code: "qa", en: ["Qatar"] },
  "Bosnia-Herceg.": { code: "ba", en: ["Bosnia and Herzegovina", "Bosnia-Herzegovina"] },
  Sveits: { code: "ch", en: ["Switzerland"] },
  Brasil: { code: "br", en: ["Brazil"] },
  Marokko: { code: "ma", en: ["Morocco"] },
  Haiti: { code: "ht", en: ["Haiti"] },
  Skottland: { code: "gb-sct", en: ["Scotland"] },
  USA: { code: "us", en: ["United States", "USA"] },
  Tyrkia: { code: "tr", en: ["Turkey", "Türkiye"] },
  Australia: { code: "au", en: ["Australia"] },
  Paraguay: { code: "py", en: ["Paraguay"] },
  Tyskland: { code: "de", en: ["Germany"] },
  Elfenbenskysten: { code: "ci", en: ["Ivory Coast", "Côte d'Ivoire"] },
  Ecuador: { code: "ec", en: ["Ecuador"] },
  Curacao: { code: "cw", en: ["Curaçao", "Curacao"] },
  Nederland: { code: "nl", en: ["Netherlands"] },
  Japan: { code: "jp", en: ["Japan"] },
  Sverige: { code: "se", en: ["Sweden"] },
  Tunisia: { code: "tn", en: ["Tunisia"] },
  Belgia: { code: "be", en: ["Belgium"] },
  Iran: { code: "ir", en: ["Iran"] },
  Egypt: { code: "eg", en: ["Egypt"] },
  "New Zealand": { code: "nz", en: ["New Zealand"] },
  Spania: { code: "es", en: ["Spain"] },
  "Saudi-Arabia": { code: "sa", en: ["Saudi Arabia"] },
  Uruguay: { code: "uy", en: ["Uruguay"] },
  "Kapp Verde": { code: "cv", en: ["Cape Verde", "Cape Verde Islands", "Cabo Verde"] },
  Frankrike: { code: "fr", en: ["France"] },
  Norge: { code: "no", en: ["Norway"] },
  Irak: { code: "iq", en: ["Iraq"] },
  Senegal: { code: "sn", en: ["Senegal"] },
  Argentina: { code: "ar", en: ["Argentina"] },
  Østerrike: { code: "at", en: ["Austria"] },
  Jordan: { code: "jo", en: ["Jordan"] },
  Algerie: { code: "dz", en: ["Algeria"] },
  Portugal: { code: "pt", en: ["Portugal"] },
  Usbekistan: { code: "uz", en: ["Uzbekistan"] },
  Colombia: { code: "co", en: ["Colombia"] },
  "DR Kongo": { code: "cd", en: ["DR Congo", "Congo DR"] },
  England: { code: "gb-eng", en: ["England"] },
  Kroatia: { code: "hr", en: ["Croatia"] },
  Panama: { code: "pa", en: ["Panama"] },
  Ghana: { code: "gh", en: ["Ghana"] },
}

export function flagUrl(noName: string): string | null {
  const t = TEAMS[noName]
  if (!t) return null
  return `https://flagcdn.com/${t.code}.svg`
}

// Build a lookup from any English name (lowercased) -> Norwegian name.
const EN_TO_NO: Record<string, string> = {}
for (const [no, t] of Object.entries(TEAMS)) {
  for (const en of t.en) EN_TO_NO[en.toLowerCase()] = no
}

export function norwegianFromEnglish(en: string): string | null {
  return EN_TO_NO[en.trim().toLowerCase()] ?? null
}
