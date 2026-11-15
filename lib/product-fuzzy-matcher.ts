// src/lib/product-fuzzy-matcher.ts

export interface ProductCandidate {
  id: string
  name: string
  sku: string
  purchasePrice?: number
  sellingPrice?: number
  mrp?: number
  category?: string
  minStock?: number
}

export interface MatchResult<T extends ProductCandidate = ProductCandidate> {
  product: T
  score: number // 0.0 to 1.0
  isConfident: boolean
}

/**
 * Normalizes text: separates units from numbers (e.g. "110mm" -> "110 mm"),
 * lowercases, strips punctuation, and collapses whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return ""
  return text
    .toLowerCase()
    .replace(/(\d+)([a-zA-Z]+)/g, "$1 $2")
    .replace(/([a-zA-Z]+)(\d+)/g, "$1 $2")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extracts dimension/size numbers (e.g. "110", "75", "63", "50")
 * so different product variants never cross-match.
 */
export function extractNumericTokens(text: string): string[] {
  const norm = normalizeText(text)
  return (norm.match(/\b\d+\b/g) || []).map(s => s.trim())
}

/**
 * Computes Levenshtein edit distance for OCR typos (e.g. "c0wl" vs "cowl").
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
    }
  }
  return matrix[b.length][a.length]
}

/**
 * Computes token-level similarity (Dice Coefficient) with single-character typo tolerance.
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeText(a).split(" ").filter(w => w.length > 1))
  const tokensB = new Set(normalizeText(b).split(" ").filter(w => w.length > 1))

  if (!tokensA.size && !tokensB.size) return 1
  if (!tokensA.size || !tokensB.size) return 0

  let matches = 0
  tokensA.forEach(tA => {
    if (tokensB.has(tA)) {
      matches++
    } else {
      for (const tB of tokensB) {
        if (Math.abs(tA.length - tB.length) <= 1 && levenshteinDistance(tA, tB) <= 1) {
          matches += 0.85
          break
        }
      }
    }
  })

  return (2 * matches) / (tokensA.size + tokensB.size)
}

/**
 * Finds the best product match in inventory with dimension safety checks.
 */
export function findBestProductMatch<T extends ProductCandidate>(
  queryName: string,
  queryCode: string | null | undefined,
  products: T[],
  minConfidence = 0.55
): MatchResult<T> | null {
  if (!products || products.length === 0) return null

  const cleanQueryCode = (queryCode || "").trim().toLowerCase()
  const cleanQueryName = normalizeText(queryName)
  const queryNums = extractNumericTokens(queryName)

  // 1. Exact SKU match (100% confidence)
  if (cleanQueryCode) {
    const exactSku = products.find(p => (p.sku || "").trim().toLowerCase() === cleanQueryCode)
    if (exactSku) return { product: exactSku, score: 1.0, isConfident: true }
  }

  // 2. Exact name match (100% confidence)
  if (cleanQueryName) {
    const exactName = products.find(p => normalizeText(p.name) === cleanQueryName)
    if (exactName) return { product: exactName, score: 1.0, isConfident: true }
  }

  let bestMatch: T | null = null
  let highestScore = 0

  for (const product of products) {
    const prodName = product.name || ""
    const normProd = normalizeText(prodName)
    if (!normProd) continue

    // Reject if dimension/size numbers conflict (e.g. 50 MM vs 110 MM)
    const prodNums = extractNumericTokens(prodName)
    if (queryNums.length > 0 && prodNums.length > 0) {
      const sharesNum = queryNums.some(qn => prodNums.includes(qn))
      if (!sharesNum) continue
    }

    const tokScore = tokenSimilarity(queryName, prodName)
    const charScore = Math.max(
      0,
      1 - levenshteinDistance(cleanQueryName, normProd) / Math.max(cleanQueryName.length, normProd.length)
    )
    const subBonus = normProd.includes(cleanQueryName) || cleanQueryName.includes(normProd) ? 0.25 : 0
    const totalScore = Math.min(1.0, tokScore * 0.55 + charScore * 0.35 + subBonus)

    if (totalScore > highestScore) {
      highestScore = totalScore
      bestMatch = product
    }
  }

  if (bestMatch && highestScore >= minConfidence) {
    return {
      product: bestMatch,
      score: Math.round(highestScore * 100) / 100,
      isConfident: true,
    }
  }

  return null
}

