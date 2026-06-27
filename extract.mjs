// Extracts all 14 contestant prediction sheets into structured JSON.
// Reads the unzipped xlsx XML directly (SheetJS chokes on the padded zip container).
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const DIR = '/tmp/xlsx'

// --- shared strings ---
const ssXml = fs.readFileSync(`${DIR}/xl/sharedStrings.xml`, 'utf8')
const shared = []
for (const m of ssXml.matchAll(/<si>(.*?)<\/si>/gs)) {
  // concatenate all <t> runs inside the <si>
  let text = ''
  for (const t of m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)) text += t[1]
  shared.push(decode(text))
}

function decode(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function colToIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0]
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

// parse a sheet into rows[rowNum][colIndex] = value
function parseSheet(file) {
  const xml = fs.readFileSync(`${DIR}/xl/worksheets/${file}`, 'utf8')
  const rows = {}
  for (const rowM of xml.matchAll(/<row r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
    const rowNum = parseInt(rowM[1], 10) - 1
    const cols = {}
    for (const cM of rowM[2].matchAll(/<c r="([A-Z]+\d+)"(?:\s+s="\d+")?(?:\s+t="([^"]+)")?\s*(?:\/>|>(.*?)<\/c>)/gs)) {
      const ref = cM[1]
      const type = cM[2]
      const inner = cM[3]
      if (inner == null) continue
      let val
      const vM = inner.match(/<v>(.*?)<\/v>/s)
      const isM = inner.match(/<is>(.*?)<\/is>/s)
      if (type === 's' && vM) val = shared[parseInt(vM[1], 10)]
      else if (type === 'inlineStr' && isM) {
        let t = ''
        for (const tt of isM[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)) t += tt[1]
        val = decode(t)
      } else if (vM) val = decode(vM[1])
      if (val !== undefined && val !== '') cols[colToIndex(ref)] = val
    }
    rows[rowNum] = cols
  }
  return rows
}

const SHEETS = {
  Ahilan: 'sheet4.xml', Haakon: 'sheet5.xml', AI: 'sheet6.xml', Jardar: 'sheet7.xml',
  Kari: 'sheet8.xml', Knut: 'sheet9.xml', 'Leif Anders': 'sheet10.xml', Magnus: 'sheet11.xml',
  Malin: 'sheet12.xml', Marit: 'sheet13.xml', Trude: 'sheet14.xml', Vidar: 'sheet15.xml',
  Øystein: 'sheet16.xml', Ådne: 'sheet17.xml',
}

// Match metadata from FIFA sheet rows 10-19 (text before the score cells)
const GROUP_MATCH_ROWS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
const fifa = parseSheet('sheet1.xml')
const matches = GROUP_MATCH_ROWS.map((r, i) => {
  const label = fifa[r][0] // e.g. "Gruppe A: Torsdag 11.06.2026 21:00  Mexico - Sør-Afrika"
  const groupM = label.match(/Gruppe ([A-L]):/)
  const after = label.split(/\d{2}:\d{2}\s+/)[1] || label
  const [home, away] = after.split(' - ').map((s) => s.trim())
  const dateM = label.match(/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})/)
  return {
    id: `m${i + 1}`,
    group: groupM ? groupM[1] : '',
    date: dateM ? dateM[1] : '',
    time: dateM ? dateM[2] : '',
    home,
    away,
  }
})

const GROUP_QUESTIONS = [
  { row: 22, key: 'gqA', text: 'Hvem blir vinner i gruppe A?' },
  { row: 23, key: 'gqB', text: 'Hvem blir toer i gruppe B?' },
  { row: 24, key: 'gqC', text: 'Går 3. plass i gruppe C videre? (J/N)' },
  { row: 25, key: 'gqD', text: 'Hvem blir vinner i gruppe D?' },
  { row: 26, key: 'gqF', text: 'Hvem blir vinner i gruppe F?' },
  { row: 27, key: 'gqG', text: 'Hvem blir vinner i gruppe G?' },
  { row: 28, key: 'gqI', text: 'Hvem blir toer i gruppe I?' },
  { row: 29, key: 'gqK', text: 'Går 3.plass i gruppe K videre? (J/N)' },
]

function pickX(cols, optionCols) {
  // optionCols: {label: colIndexOfX}
  for (const [label, c] of Object.entries(optionCols)) {
    if (cols[c] && String(cols[c]).toUpperCase() === 'X') return label
  }
  return ''
}

const contestants = []
for (const [name, file] of Object.entries(SHEETS)) {
  const r = parseSheet(file)
  const groupMatches = GROUP_MATCH_ROWS.map((row, i) => ({
    id: `m${i + 1}`,
    home: r[row][5] !== undefined ? Number(r[row][5]) : null,
    away: r[row][7] !== undefined ? Number(r[row][7]) : null,
  }))
  const groupQuestions = {}
  for (const q of GROUP_QUESTIONS) groupQuestions[q.key] = r[q.row]?.[2] ?? ''

  const norway = {
    score7plus: r[33]?.[5] ?? '',
    concede4plus: r[34]?.[5] ?? '',
    meetBrazil: r[35]?.[5] ?? '',
    furthest: pickX(r[36] || {}, { Norge: 9, England: 11, 'Like langt': 13 }),
    topScorer: pickX(r[37] || {}, { Haaland: 9, Sørloth: 11, 'En annen': 13 }),
  }

  const knockout = {
    swedenAdvances: r[41]?.[5] ?? '',
    europeanTeams: r[42]?.[5] ?? '',
    hostsAdvance: r[43]?.[5] ?? '',
    quarterfinalists: [45, 46, 47, 48, 49, 50, 51, 52].map((row) => r[row]?.[3] ?? '').filter(Boolean),
  }

  const final = {
    team1: r[55]?.[5] ?? '',
    team2: r[55]?.[9] ?? '',
    score1: r[57]?.[5] !== undefined ? Number(r[57][5]) : null,
    score2: r[57]?.[7] !== undefined ? Number(r[57][7]) : null,
    champion: r[58]?.[5] ?? '',
    topScorerCountry: r[59]?.[5] ?? '',
  }

  contestants.push({ name, groupMatches, groupQuestions, norway, knockout, final })
}

const out = {
  matches,
  groupQuestions: GROUP_QUESTIONS,
  contestants,
}

fs.mkdirSync('/vercel/share/v0-project/lib/data', { recursive: true })
fs.writeFileSync('/vercel/share/v0-project/lib/data/predictions.json', JSON.stringify(out, null, 2))
console.log('Matches:', matches.length)
console.log(JSON.stringify(matches, null, 2))
console.log('Contestants:', contestants.length)
console.log('Sample (Ahilan):', JSON.stringify(contestants[0], null, 2))
console.log('Sample (Vidar):', JSON.stringify(contestants.find((c) => c.name === 'Vidar'), null, 2))
