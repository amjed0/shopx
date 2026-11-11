"use client"

import * as React from "react"
import {
  Camera,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  X,
  ImageIcon,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"

export interface ScannedItem {
  name: string
  quantity: number
  purchasePrice: number
  category: string
}

export interface ScanResult {
  items: ScannedItem[]
  supplierName: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  totalAmount: number | null
}

interface InvoiceScannerProps {
  onScanComplete: (result: ScanResult) => void
  disabled?: boolean
}

export function InvoiceScanner({ onScanComplete, disabled }: InvoiceScannerProps) {
  const [isScanning, setIsScanning] = React.useState(false)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [fileName, setFileName] = React.useState<string>("")
  const [scanResult, setScanResult] = React.useState<ScanResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const cameraInputRef = React.useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Detect file type with fallback to extension
    let detectedType = file.type
    if (!detectedType) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'pdf') detectedType = 'application/pdf'
      else if (ext === 'png') detectedType = 'image/png'
      else if (ext === 'jpg' || ext === 'jpeg') detectedType = 'image/jpeg'
      else if (ext === 'webp') detectedType = 'image/webp'
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"]
    if (!validTypes.includes(detectedType)) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please upload an image (JPEG, PNG, WebP) or PDF file.",
      })
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum file size is 10MB.",
      })
      return
    }

    setFileName(file.name)
    setError(null)
    setScanResult(null)

    // Create preview
    if (detectedType.startsWith("image/")) {
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setPreview(null) // PDF — no preview
    }

    // Convert to base64 and scan
    await processFile(file, detectedType)
  }

  const processFile = async (file: File, fileMimeType?: string) => {
    setIsScanning(true)
    setError(null)

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const mime = fileMimeType || file.type || 'image/jpeg'

      const res = await fetch("/api/ai/extract-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          mimeType: mime,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to process invoice")
      }

      if (!data.items || data.items.length === 0) {
        throw new Error("No products found in the invoice. Please try a clearer image.")
      }

      setScanResult(data)
      onScanComplete(data)

      toast({
        title: "Invoice Scanned! ✨",
        description: `Found ${data.items.length} product${data.items.length > 1 ? "s" : ""} from ${data.supplierName || "invoice"}.`,
      })
    } catch (err: any) {
      console.error("Scan error:", err)
      setError(err.message || "Failed to scan invoice")
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: err.message || "Could not extract data from the invoice.",
      })
    } finally {
      setIsScanning(false)
    }
  }

  const handleReset = () => {
    setPreview(null)
    setFileName("")
    setScanResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (cameraInputRef.current) cameraInputRef.current.value = ""
  }

  const handleRetry = () => {
    if (fileInputRef.current?.files?.[0]) {
      processFile(fileInputRef.current.files[0])
    } else if (cameraInputRef.current?.files?.[0]) {
      processFile(cameraInputRef.current.files[0])
    }
  }

  return (
    <Card className="border-none bg-card shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || isScanning}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled || isScanning}
        />

        {/* Title */}
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            AI Invoice Scanner
          </p>
        </div>

        {/* Main UI */}
        {!preview && !fileName && !isScanning ? (
          /* Upload zone */
          <div className="space-y-2">
            <div
              className="border-2 border-dashed border-border/50 rounded-xl p-5 text-center 
                         hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Upload className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs font-bold">Upload Invoice / Bill</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Image or PDF • Max 10MB
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-lg"
                onClick={() => cameraInputRef.current?.click()}
                disabled={disabled}
              >
                <Camera className="w-3 h-3 mr-1.5" />
                Camera
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[10px] font-bold uppercase tracking-wider rounded-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <ImageIcon className="w-3 h-3 mr-1.5" />
                Gallery
              </Button>
            </div>
          </div>
        ) : (
          /* Preview / scanning state */
          <div className="space-y-3">
            {/* Preview image or PDF indicator */}
            {preview ? (
              <div className="relative rounded-lg overflow-hidden bg-secondary/20">
                <img
                  src={preview}
                  alt="Invoice preview"
                  className="w-full h-32 object-cover"
                />
                {!isScanning && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 bg-black/50 hover:bg-black/70 text-white rounded-full"
                    onClick={handleReset}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
                {isScanning && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                    <p className="text-white text-xs font-bold">AI Scanning...</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-secondary/20 rounded-lg">
                <FileText className="w-5 h-5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{fileName}</p>
                  <p className="text-[10px] text-muted-foreground">PDF Document</p>
                </div>
                {isScanning ? (
                  <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleReset}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            )}

            {/* Scan result summary */}
            {scanResult && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Scan Complete
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-[9px] h-5 font-code">
                    {scanResult.items.length} item{scanResult.items.length > 1 ? "s" : ""}
                  </Badge>
                  {scanResult.supplierName && (
                    <Badge variant="outline" className="text-[9px] h-5">
                      {scanResult.supplierName}
                    </Badge>
                  )}
                  {scanResult.totalAmount && (
                    <Badge variant="outline" className="text-[9px] h-5 font-code">
                      ₹{scanResult.totalAmount.toLocaleString()}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">
                    Scan Failed
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] w-full"
                  onClick={handleRetry}
                >
                  <RotateCcw className="w-3 h-3 mr-1.5" />
                  Retry Scan
                </Button>
              </div>
            )}

            {/* Reset button when done */}
            {(scanResult || error) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-7 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                onClick={handleReset}
              >
                Scan Another Invoice
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

