// lib/invoice-ocr.ts
// Client-side OCR engine (runs fully in the browser, no API call).
//  - Images  -> resized + contrast-enhanced -> Tesseract.js
//  - PDFs    -> pdf.js reads real text first (fast + exact). Scanned PDFs are
//               rendered to canvas and sent to Tesseract.js.
// Install:  npm i tesseract.js pdfjs-dist
export type OcrProgress = { label: string; pct: number }
type ProgressCb = (p: OcrProgress) => void

/* ───────────────────────── helpers ───────────────────────── */

export function detectMime(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  }
  return map[ext] || ""
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error("Could not read the file"))
    r.readAsDataURL(file)
  })
}

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error("This image format can't be opened by your browser. Please use JPEG or PNG.")
  }
}

/** Draw an image file onto a canvas, scaled so the longest side == maxSide. */
async function imageToCanvas(
  file: Blob,
  opts: { maxSide: number; enhance: boolean; allowUpscale: boolean }
): Promise<HTMLCanvasElement> {
  const bmp = await loadBitmap(file)
  const longest = Math.max(bmp.width, bmp.height)
  let scale = opts.maxSide / longest
  if (!opts.allowUpscale) scale = Math.min(1, scale)
  else scale = Math.min(2, scale) // never upscale more than 2x
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()

  if (opts.enhance) enhanceCanvas(canvas)
  return canvas
}

/** Grayscale + contrast stretch (2%..98% percentile). Big accuracy win on phone photos. */
function enhanceCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const hist = new Uint32Array(256)

  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    d[i] = d[i + 1] = d[i + 2] = g
    hist[g]++
  }

  const total = d.length / 4
  let acc = 0
  let lo = 0
  let hi = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= total * 0.02) { lo = v; break }
  }
  acc = 0
  for (let v = 255; v >= 0; v--) {
    acc += hist[v]
    if (acc >= total * 0.02) { hi = v; break }
  }
  const range = Math.max(1, hi - lo)

  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range))
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}

/* ───────────────────────── upload helper (for Gemini) ───────────────────────── */

/**
 * Shrinks big phone photos (4000px, 6MB+) to ~1800px JPEG before sending to your
 * Gemini API route. Large payloads are a very common reason for "scan failed".
 */
export async function fileToUploadDataUrl(file: File): Promise<{ dataUrl: string; mime: string }> {
  const mime = detectMime(file)
  if (mime.startsWith("image/") && mime !== "image/gif") {
    try {
      const c = await imageToCanvas(file, { maxSide: 1800, enhance: false, allowUpscale: false })
      return { dataUrl: c.toDataURL("image/jpeg", 0.85), mime: "image/jpeg" }
    } catch {
      /* fall through to raw upload */
    }
  }
  return { dataUrl: await readAsDataUrl(file), mime }
}

/* ───────────────────────── PDF ───────────────────────── */

async function readPdf(
  file: File,
  onProgress: ProgressCb
): Promise<{ text: string; canvases: HTMLCanvasElement[] }> {
  onProgress({ label: "Opening PDF…", pct: 3 })
  const pdfjs: any = await import("pdfjs-dist")
  // Worker loaded from CDN, always matches the installed version.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const pageCount = Math.min(pdf.numPages, 5) // invoices rarely exceed 5 pages

  // 1) Try the PDF's own text layer (digital invoices: instant + 100% accurate)
  let text = ""
  for (let p = 1; p <= pageCount; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items = (content.items as any[])
      .filter(it => it.str && it.str.trim())
      .map(it => ({ x: it.transform[4] as number, y: it.transform[5] as number, s: it.str as string }))
      .sort((a, b) => b.y - a.y)

    // cluster items into rows (same baseline ± 3 units)
    const rows: { y: number; cells: { x: number; s: string }[] }[] = []
    for (const it of items) {
      const row = rows.find(r => Math.abs(r.y - it.y) <= 3)
      if (row) row.cells.push({ x: it.x, s: it.s })
      else rows.push({ y: it.y, cells: [{ x: it.x, s: it.s }] })
    }
    for (const row of rows) {
      text += row.cells.sort((a, b) => a.x - b.x).map(c => c.s).join("  ") + "\n"
    }
    text += "\n"
    onProgress({ label: "Reading PDF text…", pct: 5 + Math.round((p / pageCount) * 15) })
  }
  if (text.replace(/\s/g, "").length > 120) return { text, canvases: [] }

  // 2) Scanned PDF (no text layer) -> render pages to canvas for OCR
  const canvases: HTMLCanvasElement[] = []
  for (let p = 1; p <= pageCount; p++) {
    onProgress({ label: `Preparing page ${p}/${pageCount}…`, pct: 20 })
    const page = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 2.2 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!
    await page.render({ canvasContext: ctx, viewport }).promise
    enhanceCanvas(canvas)
    canvases.push(canvas)
  }
  return { text: "", canvases }
}

/* ───────────────────────── Tesseract ───────────────────────── */

async function ocrCanvases(canvases: HTMLCanvasElement[], onProgress: ProgressCb): Promise<string> {
  const { createWorker } = await import("tesseract.js")
  let current = 0
  const total = canvases.length

  onProgress({ label: "Loading OCR engine (first time only)…", pct: 22 })
  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        const pct = 25 + Math.round(((current + m.progress) / total) * 73)
        onProgress({
          label: total > 1 ? `Reading text… page ${current + 1}/${total}` : "Reading text…",
          pct,
        })
      }
    },
  })

  try {
    await worker.setParameters({ preserve_interword_spaces: "1" }) // keeps table columns apart
    let text = ""
    for (let i = 0; i < total; i++) {
      current = i
      const { data } = await worker.recognize(canvases[i])
      text += data.text + "\n\n"
    }
    return text
  } finally {
    await worker.terminate()
  }
}

/* ───────────────────────── public API ───────────────────────── */

/** Returns the raw text of an invoice image/PDF, fully client-side. */
export async function extractTextFromFile(file: File, onProgress: ProgressCb = () => {}): Promise<string> {
  const mime = detectMime(file)

  if (mime === "application/pdf") {
    const { text, canvases } = await readPdf(file, onProgress)
    if (text) {
      onProgress({ label: "Done", pct: 100 })
      return text
    }
    const ocrText = await ocrCanvases(canvases, onProgress)
    onProgress({ label: "Done", pct: 100 })
    return ocrText
  }

  onProgress({ label: "Preparing image…", pct: 5 })
  const canvas = await imageToCanvas(file, { maxSide: 2000, enhance: true, allowUpscale: true })
  const text = await ocrCanvases([canvas], onProgress)
  onProgress({ label: "Done", pct: 100 })
  return text
}