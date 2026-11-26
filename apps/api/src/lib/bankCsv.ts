import { createHash } from 'crypto'

// Lecture des relevés bancaires exportés en CSV. Les banques françaises n'ont pas de format commun :
// séparateur « ; » (souvent) ou « , », virgule décimale, colonnes Montant ou Débit/Crédit, quelques lignes
// d'en-tête (compte, période) avant le tableau, encodage UTF-8 ou Windows-1252. On repère donc la ligne
// d'en-tête par les noms de colonnes, puis on lit les lignes qui suivent.

export type BankCsvRow = { date: Date; label: string; amount: number; externalId: string }
export type BankCsvResult = { rows: BankCsvRow[]; skipped: { line: number; reason: string }[]; columns: string[] }

export class BankCsvError extends Error {}

/** Minuscules, sans accents ni ponctuation, espaces simples. */
export function normalizeText(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** UTF-8 si le fichier est valide, sinon Windows-1252 (exports « Excel » des banques). */
export function decodeCsv(buf: Buffer) {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    text = new TextDecoder('windows-1252').decode(buf)
  }
  return text.replace(/^﻿/, '')
}

function detectSeparator(lines: string[]) {
  const sample = lines.slice(0, 30).join('\n')
  const count = (c: string) => sample.split(c).length - 1
  const candidates: [string, number][] = [[';', count(';')], ['\t', count('\t')], [',', count(',')]]
  // La virgule sert aussi de séparateur décimal : on ne la retient que si rien d'autre n'apparaît
  const best = candidates.filter(([c]) => c !== ',').sort((a, b) => b[1] - a[1])[0]
  return best[1] > 0 ? best[0] : ','
}

/** Découpe une ligne CSV (guillemets doublés acceptés). */
function splitLine(line: string, sep: string) {
  const cells: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { cells.push(cur); cur = '' }
    else cur += ch
  }
  cells.push(cur)
  return cells.map((c) => c.trim())
}

const isDateHeader = (h: string) => h.startsWith('date') || h === 'jour'
const isLabelHeader = (h: string) =>
  /^(libelle|label|description|intitule|detail|details|nature|informations complementaires|motif|operation)/.test(h)
const isAmountHeader = (h: string) => h.startsWith('montant') || h === 'amount'
const isDebitHeader = (h: string) => h.startsWith('debit')
const isCreditHeader = (h: string) => h.startsWith('credit')

type Columns = { date: number; labels: number[]; amount?: number; debit?: number; credit?: number }

function findColumns(headers: string[]): Columns | null {
  const h = headers.map(normalizeText)
  const dates = h.map((x, i) => (isDateHeader(x) ? i : -1)).filter((i) => i >= 0)
  if (!dates.length) return null
  // Date d'opération plutôt que date de valeur
  const date = dates.find((i) => !h[i].includes('valeur')) ?? dates[0]
  const labels = h.map((x, i) => (isLabelHeader(x) ? i : -1)).filter((i) => i >= 0)
  const amount = h.findIndex((x) => isAmountHeader(x) && !x.includes('solde'))
  const debit = h.findIndex(isDebitHeader)
  const credit = h.findIndex(isCreditHeader)
  if (!labels.length) return null
  if (amount >= 0) return { date, labels, amount }
  if (debit >= 0 || credit >= 0) return { date, labels, debit: debit >= 0 ? debit : undefined, credit: credit >= 0 ? credit : undefined }
  return null
}

/** « 1 234,56 », « -1234.56 », « +12,00 € » → nombre ; null si la cellule est vide ou illisible. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[\s  €]|EUR/g, '')
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1) }
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Le dernier des deux est le séparateur décimal, l'autre sépare les milliers
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    s = s.replace(',', '.')
  }
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Math.round((negative ? -n : n) * 100) / 100
}

/** jj/mm/aaaa, jj/mm/aa, jj-mm-aaaa, jj.mm.aaaa ou aaaa-mm-jj → date calendaire (minuit UTC). */
export function parseDate(raw: string): Date | null {
  const s = raw.trim().slice(0, 10)
  let d: number, m: number, y: number
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (match) {
    ;[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(raw.trim().split(/\s/)[0])
    if (!match) return null
    ;[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
    if (y < 100) y += 2000
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date
}

/**
 * Lit un relevé CSV. L'identifiant de chaque opération est une empreinte (date, montant, libellé, rang parmi
 * les opérations identiques du fichier) : réimporter un relevé qui chevauche le précédent ne crée pas de doublon.
 */
export function parseBankCsv(buf: Buffer): BankCsvResult {
  const lines = decodeCsv(buf).split(/\r\n|\n|\r/)
  const sep = detectSeparator(lines.filter((l) => l.trim()))
  let headerIndex = -1
  let cols: Columns | null = null
  let headers: string[] = []
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const cells = splitLine(lines[i], sep)
    const found = findColumns(cells)
    if (found) { headerIndex = i; cols = found; headers = cells; break }
  }
  if (!cols) {
    throw new BankCsvError(
      'Format de relevé non reconnu : il faut une ligne d’en-tête avec une colonne Date, une colonne Libellé et une colonne Montant (ou Débit et Crédit)'
    )
  }

  const rows: BankCsvRow[] = []
  const skipped: BankCsvResult['skipped'] = []
  const seen = new Map<string, number>()
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = splitLine(lines[i], sep)
    if (cells.every((c) => !c)) continue
    const line = i + 1
    const date = parseDate(cells[cols.date] ?? '')
    if (!date) { skipped.push({ line, reason: 'date illisible' }); continue }
    let amount: number | null
    if (cols.amount !== undefined) {
      amount = parseAmount(cells[cols.amount] ?? '')
    } else {
      const debit = cols.debit !== undefined ? parseAmount(cells[cols.debit] ?? '') : null
      const credit = cols.credit !== undefined ? parseAmount(cells[cols.credit] ?? '') : null
      amount = credit ? Math.abs(credit) : debit ? -Math.abs(debit) : credit ?? debit
    }
    if (amount === null) { skipped.push({ line, reason: 'montant illisible' }); continue }
    const parts = [...new Set(cols.labels.map((c) => (cells[c] ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))]
    const label = parts.join(' · ') || '(sans libellé)'
    const key = `${date.toISOString().slice(0, 10)}|${amount.toFixed(2)}|${normalizeText(label)}`
    const rank = (seen.get(key) ?? 0) + 1
    seen.set(key, rank)
    const externalId = 'csv:' + createHash('sha256').update(`${key}|${rank}`).digest('hex').slice(0, 32)
    rows.push({ date, label, amount, externalId })
  }
  return { rows, skipped, columns: headers.filter(Boolean) }
}
