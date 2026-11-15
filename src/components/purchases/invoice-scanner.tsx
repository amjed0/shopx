"use client"

import * as React from "react"
import {
  Camera,
  FileText,
  Loader2,
  Sparkles,
  X,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  detectMime,
  extractTextFromFile,
  fileToUploadDataUrl,
  readAsDataUrl,
  type OcrProgress,
} from "@/lib/invoice-ocr"
import { parseInvoiceText } from "@/lib/invoice-ocr-parser"

/* ───────────── Types ───────────── */

export interface ScannedItem {
  serialNumber?: string | number | null
  name: string
  itemCode?: string | null
  hsnCode?: string | null
  quantity: number
  purchasePrice: number            // cost per piece AFTER discount, BEFORE GST
  taxRate?: number | null
  taxAmount?: number | null
  sellingPrice?: number | null     // kept for old API responses
  category: string
  // NEW
  mrp?: number | null              // printed MRP column on the bill
  taxableAmount?: number | null    // line "Taxable Amount" (after discount, before GST)
  discountPercent?: number | null  // line discount %
}

export interface ScanResult {
  items: ScannedItem[]
  supplierName: string | null
  supplierGst?: string | null
  supplierPhone?: string | null
  supplierEmail?: string | null
  supplierAddress?: string | null
  supplierContactPerson?: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  totalAmount: number | null
  source?: "ai" | "ocr"
  needsReview?: boolean
}

type ScanMode = "auto" | "offline"

interface InvoiceScannerProps {
  onScanComplete: (result: ScanResult) => void
  disabled?: boolean
  existingCategories?: string[]
}

const VALID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]
const MAX_SIZE = 10 * 1024 * 1024

const round2 = (n: number) => Number(n.toFixed(2))

/* ───────────── Normalizer: MRP + correct cost per piece ───────────── */

function normalizeScanItems(items: ScannedItem[]): ScannedItem[] {
  return items.map(it => {
    const qty = Number(it.quantity) || 1
    const mrp = Number(it.mrp) || 0
    const taxable = Number(it.taxableAmount) || 0
    let cost = Number(it.purchasePrice) || 0

    // Best source of truth: taxable amount ÷ quantity (after discount, before GST)
    if (taxable > 0) cost = round2(taxable / qty)

    // GST amount: fill in if only the rate is known
    const rate = Number(it.taxRate) || 0
    let taxAmount = Number(it.taxAmount) || 0
    if (rate > 0 && taxAmount === 0) taxAmount = round2((qty * cost * rate) / 100)

    return {
      ...it,
      quantity: qty,
      purchasePrice: cost,
      taxRate: rate,
      taxAmount,
      mrp,
    }
  })
}

/* ───────────── Gemini (your existing API route) ───────────── */

async function scanWithAI(file: File, existingCategories?: string[]): Promise<ScanResult> {
  const { dataUrl, mime } = await fileToUploadDataUrl(file)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30000)

  try {
    const res = await fetch("/api/ai/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, mimeType: mime, existingCategories }),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `AI scan failed (${res.status})`)
    if (!data.items || data.items.length === 0) throw new Error("AI found no products in this file")
    return { ...data, items: normalizeScanItems(data.items), source: "ai" }
  } finally {
    clearTimeout(timer)
  }
}

/* ───────────── Component ───────────── */

export function InvoiceScanner({ onScanComplete, disabled, existingCategories }: InvoiceScannerProps) {
  const [isScanning, setIsScanning] = React.useState(false)
  const [progress, setProgress] = React.useState<OcrProgress | null>(null)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState("")
  const [scanResult, setScanResult] = React.useState<ScanResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<ScanMode>("auto")
  const [isDragging, setIsDragging] = React.useState(false)

  // desktop webcam
  const [cameraOpen, setCameraOpen] = React.useState(false)
  const [stream, setStream] = React.useState<MediaStream | null>(null)
  const videoRef = React.useRef<HTMLVideoElement | null>(null)

  const galleryInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)
  const docInputRef = React.useRef<HTMLInputElement>(null)
  const lastFileRef = React.useRef<File | null>(null)

  React.useEffect(() => {
    return () => stream?.getTracks().forEach(t => t.stop())
  }, [stream])

  /* ── core scan pipeline ── */
  const runScan = async (file: File, forceMode?: ScanMode) => {
    const activeMode = forceMode ?? mode
    setIsScanning(true)
    setError(null)
    setScanResult(null)
    setProgress({ label: activeMode === "auto" ? "AI scanning…" : "Starting offline OCR…", pct: 0 })

    try {
      let result: ScanResult | null = null

      if (activeMode === "auto") {
        try {
          result = await scanWithAI(file, existingCategories)
        } catch (aiErr: any) {
          console.warn("AI scan failed, using offline OCR:", aiErr)
          toast({ title: "AI unavailable", description: "Switching to offline OCR…" })
        }
      }

      if (!result) {
        const text = await extractTextFromFile(file, setProgress)
        console.log("[Offline OCR] Text extracted length:", text?.length)
        result = parseInvoiceText(text)
        console.log("[Offline OCR] Items parsed:", result.items?.length)
        if (!result.items.length) {
          throw new Error(
            "Offline OCR could not read the item table of this bill. Switch to the 'AI + OCR' mode, or retake the photo flat and in good light."
          )
        }
        result = { ...result, items: normalizeScanItems(result.items) }
      }

      setScanResult(result)
      onScanComplete(result)
      toast({
        title: result.source === "ocr" ? "Scanned with offline OCR ✓" : "Invoice Scanned! ✨",
        description:
          result.source === "ocr"
            ? `Found ${result.items.length} item(s). Please verify names, quantities and prices.`
            : `Found ${result.items.length} product${result.items.length > 1 ? "s" : ""} from ${result.supplierName || "invoice"}.`,
      })
    } catch (err: any) {
      console.error("Scan error:", err)
      setError(err.message || "Failed to scan invoice")
      toast({ variant: "destructive", title: "Scan Failed", description: err.message || "Could not read the file." })
    } finally {
      setIsScanning(false)
      setProgress(null)
    }
  }

  /* ── file handling ── */
  const handleFile = async (file: File) => {
    const type = detectMime(file)
    if (!VALID_TYPES.includes(type)) {
      toast({ variant: "destructive", title: "Invalid file", description: "Use a JPEG, PNG, WebP image or a PDF." })
      return
    }
    if (file.size > MAX_SIZE) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum file size is 10MB." })
      return
    }

    lastFileRef.current = file
    setFileName(file.name)
    setScanResult(null)
    setError(null)
    setPreview(type.startsWith("image/") ? await readAsDataUrl(file).catch(() => null) : null)

    runScan(file)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (file) handleFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled || isScanning) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  /* ── camera ── */
  const handleCameraClick = async () => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobile || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setStream(s)
      setCameraOpen(true)
    } catch {
      toast({ title: "Camera not available", description: "Opening file picker instead." })
      cameraInputRef.current?.click()
    }
  }

  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream
      el.play().catch(() => {})
    }
  }

  const closeCamera = () => {
    setCameraOpen(false)
    setStream(null)
  }

  const captureFrame = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext("2d")!.drawImage(v, 0, 0)
    canvas.toBlob(
      blob => {
        if (!blob) return
        const file = new File([blob], `invoice-${Date.now()}.jpg`, { type: "image/jpeg" })
        closeCamera()
        handleFile(file)
      },
      "image/jpeg",
      0.92
    )
  }

  /* ── reset / retry ── */
  const handleReset = () => {
    setPreview(null)
    setFileName("")
    setScanResult(null)
    setError(null)
    lastFileRef.current = null
  }

  const handleRetry = (forceMode?: ScanMode) => {
    if (lastFileRef.current) runScan(lastFileRef.current, forceMode)
  }

  const busy = disabled || isScanning
  const showUploader = !preview && !fileName && !isScanning

  return (
    <Card className="border-none bg-card shadow-sm">
      <CardContent className="p-4 space-y-3">
        <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} disabled={busy} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInputChange} disabled={busy} />
        <input ref={docInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onInputChange} disabled={busy} />

        {/* Title + mode switch */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Invoice Scanner</p>
          </div>
          <div className="flex items-center bg-secondary/40 border border-border/50 rounded-lg p-0.5 gap-0.5">
            {([
              ["auto", "AI + OCR"],
              ["offline", "Offline OCR"],
            ] as [ScanMode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                disabled={isScanning}
                onClick={() => setMode(m)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                  mode === m ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                title={m === "auto" ? "Try Gemini AI first, fall back to offline OCR if it fails" : "Skip AI. Read the bill on this device only"}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {showUploader ? (
          <div className="space-y-2">
            <div
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                isDragging ? "border-accent bg-accent/10" : "border-border/50"
              }`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="w-5 h-5 text-accent" />
                <p className="text-xs font-bold">Drop a bill here</p>
                <p className="text-[10px] text-muted-foreground">JPEG, PNG, WebP or PDF • Max 10MB</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-auto py-2 flex-col gap-1 text-[10px] font-bold rounded-lg" onClick={handleCameraClick} disabled={busy}>
                <Camera className="w-4 h-4" />
                Take Photo
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-auto py-2 flex-col gap-1 text-[10px] font-bold rounded-lg" onClick={() => galleryInputRef.current?.click()} disabled={busy}>
                <ImageIcon className="w-4 h-4" />
                Gallery
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-auto py-2 flex-col gap-1 text-[10px] font-bold rounded-lg" onClick={() => docInputRef.current?.click()} disabled={busy}>
                <FileText className="w-4 h-4" />
                Document
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {preview ? (
              <div className="relative rounded-lg overflow-hidden bg-secondary/20">
                <img src={preview} alt="Invoice preview" className="w-full h-32 object-cover" />
                {!isScanning && (
                  <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 text-white rounded-full" onClick={handleReset}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-secondary/20 rounded-lg">
                <FileText className="w-5 h-5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{fileName}</p>
                  <p className="text-[10px] text-muted-foreground">PDF Document</p>
                </div>
                {!isScanning && (
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleReset}>
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}

            {isScanning && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                    {progress?.label || "Scanning…"}
                  </span>
                  {progress && progress.pct > 0 && <span className="font-code">{progress.pct}%</span>}
                </div>
                <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                  <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.max(4, progress?.pct ?? 4)}%` }} />
                </div>
              </div>
            )}

            {scanResult && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Scan Complete</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-auto">
                    {scanResult.source === "ocr" ? "Offline OCR" : "AI"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[9px] h-5 font-code">
                    {scanResult.items.length} item{scanResult.items.length > 1 ? "s" : ""}
                  </Badge>
                  {scanResult.supplierName && <Badge variant="outline" className="text-[9px] h-5">{scanResult.supplierName}</Badge>}
                  {scanResult.totalAmount ? (
                    <Badge variant="outline" className="text-[9px] h-5 font-code">₹{scanResult.totalAmount.toLocaleString()}</Badge>
                  ) : null}
                </div>
                {scanResult.source === "ocr" && (
                  <p className="text-[10px] text-amber-500">
                    {scanResult.needsReview
                      ? "Some rows were guessed. Check qty and cost in the sheet."
                      : "Offline OCR can misread digits. Quickly verify the sheet."}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Scan Failed</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{error}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleRetry()}>
                    <RotateCcw className="w-3 h-3 mr-1.5" /> Retry
                  </Button>
                  {mode !== "offline" && (
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleRetry("offline")}>
                      Use Offline OCR
                    </Button>
                  )}
                </div>
              </div>
            )}

            {(scanResult || error) && !isScanning && (
              <Button type="button" variant="ghost" size="sm" className="w-full h-7 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" onClick={handleReset}>
                Scan Another Invoice
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Desktop webcam dialog */}
      <Dialog open={cameraOpen} onOpenChange={open => { if (!open) closeCamera() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Take a photo of the bill</DialogTitle>
          </DialogHeader>
          <video ref={attachVideo} playsInline muted className="w-full rounded-lg bg-black aspect-video object-cover" />
          <p className="text-[11px] text-muted-foreground">Hold the bill flat and keep the whole item table inside the frame.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={closeCamera}>Cancel</Button>
            <Button type="button" size="sm" className="bg-accent text-accent-foreground font-bold" onClick={captureFrame}>
              <Camera className="w-4 h-4 mr-1.5" /> Capture &amp; Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}