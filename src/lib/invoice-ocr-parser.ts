// lib/invoice-ocr-parser.ts
// Turns raw OCR / PDF text into the SAME ScanResult shape your Gemini route returns,
// so purchase-entry/page.tsx works with it unchanged.
// 100% local: multi-line table row assembler + regex + resilient Indian GST arithmetic solver.

import type { ScanResult, ScannedItem } from "@/lib/invoice-types"

const GST_SLABS = [0.25, 3, 5, 12, 18, 28]

const GSTIN_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

const COMMON_HARDWARE_WORDS = new Set([
  "VENT", "COWL", "PIPE", "PIPES", "FITTING", "FITTINGS", "TEE", "ELBOW", "BEND",
  "VALVE", "SOCKET", "NIPPLE", "UNION", "REDUCER", "PLUG", "CAP", "BUSH", "BUSHING",
  "FLANGE", "TRAP", "COLLAR", "COUPLING", "HOSE", "TANK", "CLAMP", "CLIP",
  "BULB", "TUBE", "LIGHT", "LAMP", "LED", "CABLE", "WIRE", "WIRES", "SWITCH", "SWITCHES",
  "MCB", "RCCB", "ELCB", "ISOLATOR", "DB", "BOARD", "BOX", "CONDUIT", "CASING",
  "FAN", "REGULATOR", "HEATER", "GEYSER", "PUMP", "MOTOR", "STARTER", "PANEL",
  "STAR", "SUPREME", "FINOLEX", "ASTRAL", "ASHIRVAD", "PRINCE", "HAVELLS", "ANCHOR",
  "CROMPTON", "VGUARD", "LEGRAND", "SCHNEIDER", "POLYCAB", "KEI", "RR", "GM",
  "PVC", "CPVC", "UPVC", "SWR", "HDPE", "GI", "MS", "SS", "BRASS", "COPPER",
  "NET", "WITH", "SET", "PAIR", "PCS", "PIECE", "MTR", "METER", "INCH", "MM", "CM"
])

const DIMENSION_UNITS = ["MM", "CM", "INCH", "IN", "MTR", "M", "FT", "KG", "G", "LTR", "L", "ML", "W", "V", "A"]

const round2 = (n: number) => Math.round(n * 100) / 100
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.6, Math.abs(b) * 0.008)

function titleCase(s: string) {
  const letters = s.replace(/[^A-Za-z]/g, "")
  if (letters && letters === letters.toUpperCase()) {
    return s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
  }
  return s
}

function cleanLine(l: string) {
  return l
    .replace(/[|¦_~=\[\]\\/]+/g, " ")
    .replace(/₹\s*/g, " ")
    .replace(/\b(?:Rs\.?|INR)\s+/gi, " ")
    .replace(/(\d)\s*\.\s*(\d{2})(?!\d)/g, "$1.$2")
    .replace(/(?<!\d)(\d{1,3})\s*,\s*(\d{3})(?!\d)/g, "$1$2")
    .replace(/\b55\s+NET\b/gi, "SS NET")
    .replace(/\s+/g, " ")
    .trim()
}

function isGarbageOcr(word: string) {
  if (/^[a-z]+\d+[a-z]+/i.test(word) || /\d+[a-z]+\d+/i.test(word)) {
    if (!/^\d+(\.\d+)?(mm|cm|sqmm|inch|in|m|ft|w|v|a|hp|kg|g|ltr)$/i.test(word)) {
      return true
    }
  }
  return false
}

function isValidProductName(name: string): boolean {
  if (!name || name.trim().length < 3) return false
  const clean = name.trim().toLowerCase()

  if (/^(all|the|total|sub\s*total|tax|cgst|sgst|igst|discount|round|bank|ifsc|for|page|remarks|contact|date|invoice|bill)\b/i.test(clean)) {
    return false
  }

  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  if (words.some(w => isGarbageOcr(w))) return false

  let matchCount = 0
  for (const w of words) {
    const upper = w.toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (COMMON_HARDWARE_WORDS.has(upper)) matchCount += 2
    else if (upper.length >= 3 && /[aeiou]/i.test(upper)) matchCount += 1
  }

  return matchCount >= 1
}

function solveNumbers(rawNums: number[]) {
  const nums = rawNums.filter(n => n > 0 && n < 100000)
  if (nums.length === 0) {
    return { mrp: 0, qty: 1, cost: 0, taxable: 0, gstRate: 0, gstAmt: 0, confident: false }
  }

  // 1. Discount invoice: Gross - DiscAmt = Taxable
  for (let g = 0; g < nums.length; g++) {
    const gross = nums[g]
    if (gross <= 1) continue
    for (let d = g + 1; d < nums.length; d++) {
      const discAmt = nums[d]
      for (let t = d + 1; t < nums.length; t++) {
        const taxable = nums[t]
        if (taxable > 0 && close(gross - discAmt, taxable)) {
          let qty = 1
          const beforeGross = nums.slice(0, g)
          for (let q = beforeGross.length - 1; q >= 0; q--) {
            const cand = beforeGross[q]
            if (cand >= 1 && cand <= 500 && (Number.isInteger(cand) || cand % 1 === 0)) {
              qty = cand
              break
            }
          }
          const mrp = round2(gross / qty)
          const cost = round2(taxable / qty)
          return { mrp, qty, cost, taxable, gstRate: 18, gstAmt: round2(taxable * 0.18), confident: true }
        }
      }
    }
  }

  // 2. Deduction from MRP + Qty + DiscAmt
  for (let m = 0; m < nums.length; m++) {
    const mrp = nums[m]
    if (mrp < 5 || mrp > 5000) continue
    for (let q = 0; q < nums.length; q++) {
      if (q === m) continue
      const qty = nums[q]
      if (qty >= 1 && qty <= 200 && (Number.isInteger(qty) || qty % 1 === 0)) {
        const gross = round2(mrp * qty)
        for (let d = 0; d < nums.length; d++) {
          if (d === m || d === q) continue
          const discAmt = nums[d]
          if (discAmt > 0 && discAmt < gross) {
            const taxable = round2(gross - discAmt)
            const gstAmt = round2(taxable * 0.18)
            const total = round2(taxable + gstAmt)

            const matchesTaxable = nums.some(n => close(n, taxable))
            const matchesGst = nums.some(n => close(n, gstAmt))
            const matchesTotal = nums.some(n => close(n, total) || Math.abs(n - total) < 2)

            if (matchesTaxable || matchesGst || matchesTotal) {
              const cost = round2(taxable / qty)
              return { mrp, qty, cost, taxable, gstRate: 18, gstAmt, total, confident: true }
            }
          }
        }
      }
    }
  }

  // 3. Standard Qty * Rate = Taxable
  for (let i = 0; i < nums.length - 1; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      const a = nums[i], b = nums[j]
      if (a <= 0 || b <= 0) continue
      for (let k = j + 1; k < nums.length; k++) {
        const c = nums[k]
        if (close(c, a * b) && c > 0) {
          const qty = a <= 1000 && Number.isInteger(a) ? a : (b <= 1000 && Number.isInteger(b) ? b : Math.min(a, b))
          const rate = qty === a ? b : a
          return { mrp: rate, qty, cost: rate, taxable: c, gstRate: 18, gstAmt: round2(c * 0.18), confident: true }
        }
      }
    }
  }

  // 4. Fallback heuristic
  let foundQty = 1
  for (const n of nums) {
    if (n >= 1 && n <= 100 && (Number.isInteger(n) || n % 1 === 0)) {
      foundQty = n
      break
    }
  }
  const positive = nums.filter(n => n > 0)
  const largest = positive.length > 0 ? Math.max(...positive) : 0
  const cost = foundQty > 1 && largest > foundQty ? round2(largest / foundQty) : largest

  return { mrp: cost, qty: foundQty, cost, taxable: round2(foundQty * cost), gstRate: 18, gstAmt: round2(foundQty * cost * 0.18), confident: false }
}

function findGstin(text: string): string | null {
  const m = text.toUpperCase().match(GSTIN_RE)
  return m ? m[0] : null
}

function findPhone(lines: string[]): string | null {
  for (const line of lines.slice(0, 18)) {
    if (GSTIN_RE.test(line.toUpperCase())) continue
    const squeezed = line.replace(/[\s\-().]/g, "")
    const m = squeezed.match(/(?:\+?91|0)?([6-9]\d{9})(?!\d)/)
    if (m) return m[1]
  }
  return null
}

function findInvoiceNumber(text: string): string | null {
  const m = text.match(
    /(?:invoice|inv|bill)\s*(?:no|number|num|#)\s*\.?\s*[:\-#]?\s*((?=[A-Z0-9\/\-]*\d)[A-Z0-9][A-Z0-9\/\-]{1,20})/i
  )
  return m ? m[1] : null
}

function findSupplierName(lines: string[]): string | null {
  const BUSINESS =
    /\b(traders?|enterprises?|stores?|agenc(?:y|ies)|distributors?|ltd|limited|pvt|private|company|corporation|industries|marketing|sales|wholesale|suppliers?|electricals?|electronics|hardware|steels?|medicals?|pharma|foods?|mart|bazaar|centre|center|associates|brothers|bros|sons|enterprise|trading)\b/i
  const BAD =
    /invoice|bill\s*to|buyer|consignee|ship\s*to|customer|tax\s*invoice|bill\s*of\s*supply|original|duplicate|gstin|cash|credit|estimate|quotation|proforma|e-way/i

  const top = lines.slice(0, 12).filter(l => l.replace(/[^A-Za-z]/g, "").length >= 4)
  const biz = top.find(l => BUSINESS.test(l) && !BAD.test(l))
  if (biz) return titleCase(biz.replace(/[^\w\s&.,'()-]/g, "").trim())

  const first = top.find(l => !BAD.test(l) && l.length <= 60)
  return first ? titleCase(first.replace(/[^\w\s&.,'()-]/g, "").trim()) : null
}

function findTotal(lines: string[]): number | null {
  let best: number | null = null
  for (const l of lines) {
    if (!/\b(grand\s*total|net\s*(?:payable|amount)|total\s*amount|amount\s*payable|invoice\s*(?:total|value)|bill\s*amount|total)\b/i.test(l)) continue
    if (/in\s*words|\bqty\b|quantity|items?\b/i.test(l)) continue
    const nums = (l.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => parseFloat(n.replace(/,/g, ""))).filter(n => n > 0 && n < 1000000)
    for (const n of nums) if (best === null || n > best) best = n
  }
  return best
}

export function parseInvoiceText(rawText: string): ScanResult {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean)
  const joined = lines.join("\n")
  const blocks: { serial: string | null; text: string }[] = []
  let currentBlock: { serial: string | null; text: string } | null = null
  let tableStarted = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Table end
    if (tableStarted && /\b(round(?:\s*off)?|amount\s+in\s+words|rupees?\s+only|for\s+[a-z]+|bank\s*details)\b/i.test(line)) {
      if (currentBlock) blocks.push(currentBlock)
      currentBlock = null
      break
    }

    // Table start
    if (!tableStarted) {
      if (/\b(hsn|commodity|particulars|description|mrp|discount|taxable)\b/i.test(line)) {
        tableStarted = true
        continue
      }
      if (/^\s*0?1\s+[A-Za-z(]/i.test(line)) {
        tableStarted = true
      } else {
        continue
      }
    }

    // Serial line starts a new block
    const m = line.match(/^(\d{1,3})\s+([A-Za-z(].*)$/)
    if (m) {
      if (currentBlock) blocks.push(currentBlock)
      currentBlock = { serial: m[1], text: m[2] }
      continue
    }

    if (currentBlock) {
      currentBlock.text += " " + line
    }
  }

  if (currentBlock) blocks.push(currentBlock)

  const items: ScannedItem[] = []

  for (const b of blocks) {
    const tokens = b.text.split(/\s+/).filter(Boolean)
    const financialNumbers: number[] = []
    const nameTokens: string[] = []
    let hsnCode: string | null = null

    for (let i = 0; i < tokens.length; i++) {
      const rawToken = tokens[i]
      const cleanToken = rawToken.replace(/[),\]|%]/g, "").trim()

      if (/^\d{6,8}$/.test(cleanToken) && !hsnCode && financialNumbers.length === 0) {
        hsnCode = cleanToken
        continue
      }

      if (/^\d+$/.test(cleanToken)) {
        const nextToken = tokens[i + 1] ? tokens[i + 1].toUpperCase().replace(/\W/g, "") : ""
        if (DIMENSION_UNITS.includes(nextToken)) {
          nameTokens.push(rawToken)
          continue
        }
      }

      const numVal = parseFloat(cleanToken)
      if (!isNaN(numVal) && /^\d+(\.\d+)?$/.test(cleanToken)) {
        financialNumbers.push(numVal)
        continue
      }

      const cleanWord = rawToken.replace(/[^\w&()./+\-]/g, "").trim()
      if (cleanWord.length > 0 && !/^\d+$/.test(cleanWord)) {
        nameTokens.push(cleanWord)
      }
    }

    const name = nameTokens.join(" ").replace(/\s+/g, " ").trim()
    if (!isValidProductName(name)) continue

    const sol = solveNumbers(financialNumbers)
    items.push({
      serialNumber: b.serial,
      name,
      itemCode: null,
      hsnCode,
      quantity: sol.qty,
      purchasePrice: round2(sol.cost),
      mrp: sol.mrp > 0 ? round2(sol.mrp) : null,
      taxableAmount: sol.taxable > 0 ? round2(sol.taxable) : null,
      taxRate: sol.gstRate || 0,
      taxAmount: sol.gstAmt || 0,
      category: "General",
    })
  }

  return {
    items,
    supplierName: findSupplierName(lines),
    supplierGst: findGstin(joined),
    supplierPhone: findPhone(lines),
    supplierEmail: joined.match(EMAIL_RE)?.[0] ?? null,
    supplierAddress: null,
    supplierContactPerson: null,
    invoiceNumber: findInvoiceNumber(joined),
    invoiceDate: null,
    totalAmount: findTotal(lines),
    source: "ocr",
    needsReview: items.length === 0,
  }
}
