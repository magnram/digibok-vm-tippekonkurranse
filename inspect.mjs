import { readFileSync } from 'fs'

const DIR = '/tmp/xlsx'

// shared strings
const ss = readFileSync(`${DIR}/xl/sharedStrings.xml`, 'utf8')
const shared = []
{
  const re = /<si>(.*?)<\/si>/gs
  let m
  while ((m = re.exec(ss))) {
    // concat all <t> inside
    const tre = /<t[^>]*>(.*?)<\/t>/gs
    let t, str = ''
    while ((t = tre.exec(m[1]))) str += t[1]
    shared.push(decode(str))
  }
}
function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
}

function colToNum(col) {
  let n = 0
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function parseSheet(file) {
  const xml = readFileSync(`${DIR}/xl/worksheets/${file}`, 'utf8')
  const rows = {}
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs
  let rm
  while ((rm = rowRe.exec(xml))) {
    const rIdx = parseInt(rm[1]) - 1
    const cells = []
    const cellRe = /<c r="([A-Z]+)\d+"(?:[^>]*?t="([^"]*)")?[^>]*>(?:<v>(.*?)<\/v>|<is><t[^>]*>(.*?)<\/t><\/is>)?<\/c>/gs
    let cm
    while ((cm = cellRe.exec(rm[2]))) {
      const col = colToNum(cm[1])
      const type = cm[2]
      let val = cm[3]
      let inline = cm[4]
      let out
      if (inline != null) out = decode(inline)
      else if (val == null) out = ''
      else if (type === 's') out = shared[parseInt(val)]
      else out = decode(val)
      cells[col] = out
    }
    rows[rIdx] = cells
  }
  return rows
}

function printSheet(file, name, maxRow = 64, maxCol = 90) {
  const rows = parseSheet(file)
  console.log('\n\n========== ' + name + ' (' + file + ') ==========')
  const keys = Object.keys(rows).map(Number).sort((a, b) => a - b)
  for (const r of keys) {
    if (r > maxRow) break
    const cells = rows[r]
    const out = []
    for (let c = 0; c <= maxCol; c++) {
      if (cells[c] !== undefined && cells[c] !== '') out.push(c + ':' + cells[c])
    }
    if (out.length) console.log('R' + r, out.join(' | '))
  }
}

const arg = process.argv[2]
if (arg === 'sum') printSheet('sheet2.xml', 'Sammendrag')
else if (arg === 'fifa') printSheet('sheet1.xml', 'FIFA World cup 2026')
else if (arg === 'ahilan') printSheet('sheet4.xml', 'Ahilan')
else if (arg === 'data') printSheet('sheet18.xml', 'Data')
else if (arg === 'ark') printSheet('sheet3.xml', 'Ark1')
else printSheet('sheet2.xml', 'Sammendrag')
