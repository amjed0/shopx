/**
 * Utility for fuzzy matching OCR-extracted product strings against existing store inventory.
 * Zero external dependencies. Fast, robust against OCR noise, typos, formatting, and token order variations.
 */

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
  score: number // 0 to 1
  isConfident: boolean
}

/**
 * Normalizes text:
 * - Separates numbers attached to units (e.g. "110mm" -> "110 mm")
 * - Converts to lowercase
 * - Strips punctuation and extra symbols
 * - Collapses whitespace
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
 * Extracts distinct numerical tokens from a string (e.g. sizes/dimensions: "110", "75", "63", "50").
 * This is critical: if two hardware/plumbing products have different sizes, they must NOT match.
 */
export function extractNumericTokens(text: string): string[] {
  const norm = normalizeText(text)
  return (norm.match(/\b\d+\b/g) || []).map(s => s.trim())
}

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Computes string similarity between 0 and 1 using Levenshtein distance.
 */
export function stringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a)
  const normB = normalizeText(b)
  if (!normA && !normB) return 1
  if (!normA || !normB) return 0
  if (normA === normB) return 1

  const maxLen = Math.max(normA.length, normB.length)
  const dist = levenshteinDistance(normA, normB)
  return Math.max(0, 1 - dist / maxLen)
}

/**
 * Computes token-based similarity (Dice coefficient) with typo tolerance for each token.
 */
export function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeText(a).split(" ").filter(w => w.length > 1))
  const tokensB = new Set(normalizeText(b).split(" ").filter(w => w.length > 1))

  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let matches = 0
  tokensA.forEach(tA => {
    if (tokensB.has(tA)) {
      matches++
    } else {
      // Check for minor OCR typos (e.g. "c0wl" vs "cowl", "st4r" vs "star")
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
 * Find best matching product from database for an OCR-extracted name or code.
 * @param queryName The raw or cleaned name from OCR
 * @param queryCode Optional SKU / code from bill
 * @param products List of existing products in user's inventory
 * @param minConfidence Minimum score to accept a match (default: 0.55)
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

    // CRITICAL SAFETY CHECK FOR SIZES / DIMENSIONS:
    // If OCR extracted dimension numbers (e.g. "110", "75", "63", "50") and the candidate product
    // has a different dimension number, reject it immediately so different sizes never collide!
    const prodNums = extractNumericTokens(prodName)
    if (queryNums.length > 0 && prodNums.length > 0) {
      const sharesAtLeastOneNum = queryNums.some(qn => prodNums.includes(qn))
      if (!sharesAtLeastOneNum) {
        continue // Dimension mismatch (e.g. 110 MM vs 75 MM)
      }
    }

    // Token similarity (handles wrapped lines, reordered words, partial additions)
    const tokScore = tokenSimilarity(queryName, prodName)
    // Character-level similarity
    const charScore = stringSimilarity(queryName, prodName)

    // Substring bonus (e.g. OCR is "Star Vent Cowl 110 MM", DB has "STAR VENT COWL (H) 110 MM WITH SS NET")
    let subBonus = 0
    if (normProd.includes(cleanQueryName) || cleanQueryName.includes(normProd)) {
      subBonus = 0.25
    }

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
