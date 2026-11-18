"use client"

import * as React from "react"
import {
  Building2,
  Plus,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Landmark,
  Wrench,
  Computer,
  Armchair,
  Car,
  PaintBucket,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  FileText,
  Sparkles,
  Scale,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { useUser } from "@/app/auth/use-user"
import { cn } from "@/lib/utils"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FixedAsset {
  id: string
  name: string
  amount: number | string
  category: string
  date: string
}

interface BankLoan {
  id: string
  bankName: string
  loanAmount: number | string
  interestRate: number | string
  startDate: string
  note: string
}

interface Renovation {
  id: string
  description: string
  amount: number | string
  date: string
  note: string
}

interface CapitalData {
  businessType: "new" | "existing"
  ownerCapital: number | string
  fixedAssets: FixedAsset[]
  bankLoans: BankLoan[]
  renovations: Renovation[]
  openingStockManual: number | string
  notes: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = [
  { value: "computer", label: "Computer / IT Equipment", icon: Computer },
  { value: "furniture", label: "Furniture & Fixtures", icon: Armchair },
  { value: "interior", label: "Interior & Decoration", icon: PaintBucket },
  { value: "vehicle", label: "Vehicle / Transport", icon: Car },
  { value: "equipment", label: "Machinery & Equipment", icon: Wrench },
  { value: "property", label: "Property / Land", icon: Landmark },
  { value: "other", label: "Other Fixed Asset", icon: Package },
]

const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const today = () => new Date().toISOString().split("T")[0]
const fmt = (n: number | string) =>
  Number(n || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

const emptyAsset = (): FixedAsset => ({ id: uid(), name: "", amount: "", category: "equipment", date: today() })
const emptyLoan = (): BankLoan => ({ id: uid(), bankName: "", loanAmount: "", interestRate: "", startDate: today(), note: "" })
const emptyReno = (): Renovation => ({ id: uid(), description: "", amount: "", date: today(), note: "" })

const DEFAULT_DATA: CapitalData = {
  businessType: "new",
  ownerCapital: "",
  fixedAssets: [emptyAsset()],
  bankLoans: [],
  renovations: [],
  openingStockManual: "",
  notes: "",
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CapitalAccountPage() {
  const { user } = useUser()

  const [data, setData] = React.useState<CapitalData>(DEFAULT_DATA)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [saved, setSaved] = React.useState(false)
  const [openingStockFromPurchases, setOpeningStockFromPurchases] = React.useState(0)
  const [showAssetsDetail, setShowAssetsDetail] = React.useState(true)
  const [showLoansDetail, setShowLoansDetail] = React.useState(true)
  const [showRenovationsDetail, setShowRenovationsDetail] = React.useState(true)

  // ── Load capital data ──
  const loadData = React.useCallback(async () => {
    if (!user?.uid) return
    setIsLoading(true)
    try {
      const [capRes, purRes] = await Promise.all([
        fetch("/api/capital", { headers: { "x-user-id": user.uid } }),
        fetch("/api/purchases", { headers: { "x-user-id": user.uid } }),
      ])
      if (capRes.ok) {
        const json = await capRes.json()
        if (json && json.businessType) {
          setData({
            businessType: json.businessType || "new",
            ownerCapital: json.ownerCapital ?? "",
            fixedAssets: (json.fixedAssets || []).length > 0 ? json.fixedAssets : [emptyAsset()],
            bankLoans: json.bankLoans || [],
            renovations: json.renovations || [],
            openingStockManual: json.openingStockManual ?? "",
            notes: json.notes || "",
          })
        }
      }
      if (purRes.ok) {
        const purchases = await purRes.json()
        const openingTotal = Array.isArray(purchases)
          ? purchases
              .filter((p: any) => p.isOpeningStock)
              .reduce((sum: number, p: any) => sum + (Number(p.purchasePrice) || 0) * (Number(p.quantity) || 0), 0)
          : 0
        setOpeningStockFromPurchases(openingTotal)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid])

  React.useEffect(() => { loadData() }, [loadData])

  // ── Computed totals ──
  const totalFixedAssets = React.useMemo(() => {
    return data.fixedAssets
      .filter(a => a.name && Number(a.amount) > 0)
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0)
  }, [data.fixedAssets])

  const totalLoans = React.useMemo(() => {
    return data.bankLoans.reduce((sum, l) => sum + (Number(l.loanAmount) || 0), 0)
  }, [data.bankLoans])

  const totalRenovations = React.useMemo(() => {
    return data.renovations.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  }, [data.renovations])

  const effectiveOpeningStock = openingStockFromPurchases > 0
    ? openingStockFromPurchases
    : Number(data.openingStockManual) || 0

  // Balance Sheet Equation:
  // Total Assets = Capital (Equity) + Liabilities
  // Assets = Fixed Assets + Opening Stock + Opening Cash/Bank (from capital invested - loans used for assets)
  const totalAssets = totalFixedAssets + effectiveOpeningStock + (Number(data.ownerCapital) || 0) + totalLoans - totalFixedAssets - effectiveOpeningStock
  // Simplified: Total Investment = Capital + Loans
  const totalInvestment = (Number(data.ownerCapital) || 0) + totalLoans
  const totalApplicationOfFunds = totalFixedAssets + effectiveOpeningStock + totalRenovations
  const workingCapital = totalInvestment - totalApplicationOfFunds

  // ── Save ──
  const handleSave = async () => {
    if (!user?.uid) return
    setIsSaving(true)
    try {
      const payload = {
        ...data,
        ownerCapital: Number(data.ownerCapital) || 0,
        openingStockManual: Number(data.openingStockManual) || 0,
        fixedAssets: data.fixedAssets
          .filter(a => a.name.trim() && Number(a.amount) > 0)
          .map(a => ({ ...a, amount: Number(a.amount) })),
        bankLoans: data.bankLoans
          .filter(l => l.bankName.trim() && Number(l.loanAmount) > 0)
          .map(l => ({ ...l, loanAmount: Number(l.loanAmount), interestRate: Number(l.interestRate) || 0 })),
        renovations: data.renovations
          .filter(r => r.description.trim() && Number(r.amount) > 0)
          .map(r => ({ ...r, amount: Number(r.amount) })),
      }

      const res = await fetch("/api/capital", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Failed to save")

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      toast({ title: "Capital Account Saved ✓", description: "Your capital investment details have been saved and linked to the Balance Sheet." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save Failed", description: err.message })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Asset helpers ──
  const updateAsset = (id: string, field: keyof FixedAsset, value: any) =>
    setData(d => ({ ...d, fixedAssets: d.fixedAssets.map(a => a.id === id ? { ...a, [field]: value } : a) }))
  const addAsset = () => setData(d => ({ ...d, fixedAssets: [...d.fixedAssets, emptyAsset()] }))
  const removeAsset = (id: string) =>
    setData(d => ({ ...d, fixedAssets: d.fixedAssets.filter(a => a.id !== id) }))

  // ── Loan helpers ──
  const updateLoan = (id: string, field: keyof BankLoan, value: any) =>
    setData(d => ({ ...d, bankLoans: d.bankLoans.map(l => l.id === id ? { ...l, [field]: value } : l) }))
  const addLoan = () => setData(d => ({ ...d, bankLoans: [...d.bankLoans, emptyLoan()] }))
  const removeLoan = (id: string) =>
    setData(d => ({ ...d, bankLoans: d.bankLoans.filter(l => l.id !== id) }))

  // ── Renovation helpers ──
  const updateReno = (id: string, field: keyof Renovation, value: any) =>
    setData(d => ({ ...d, renovations: d.renovations.map(r => r.id === id ? { ...r, [field]: value } : r) }))
  const addReno = () => setData(d => ({ ...d, renovations: [...d.renovations, emptyReno()] }))
  const removeReno = (id: string) =>
    setData(d => ({ ...d, renovations: d.renovations.filter(r => r.id !== id) }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-16">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold">
            Capital <span className="text-accent">Account</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Record your business investment, fixed assets, opening stock and liabilities. Feeds directly into the Balance Sheet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl text-xs h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="rounded-xl text-xs h-8 gap-1.5 bg-primary"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Saved!" : "Save Capital Account"}
          </Button>
        </div>
      </div>

      {/* ── BUSINESS TYPE SELECTOR ── */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Business Setup Type
          </CardTitle>
          <CardDescription className="text-xs">Select the right mode for your situation</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setData(d => ({ ...d, businessType: "new" }))}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all space-y-1",
                data.businessType === "new"
                  ? "border-primary bg-primary/5"
                  : "border-border/50 hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", data.businessType === "new" ? "border-primary" : "border-muted-foreground")}>
                  {data.businessType === "new" && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <span className="font-bold text-sm">🆕 New Business</span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">Starting fresh — record all capital, fixed assets, loans, and opening stock from scratch.</p>
            </button>
            <button
              type="button"
              onClick={() => setData(d => ({ ...d, businessType: "existing" }))}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all space-y-1",
                data.businessType === "existing"
                  ? "border-accent bg-accent/5"
                  : "border-border/50 hover:border-accent/40"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", data.businessType === "existing" ? "border-accent" : "border-muted-foreground")}>
                  {data.businessType === "existing" && <div className="w-2 h-2 rounded-full bg-accent" />}
                </div>
                <span className="font-bold text-sm">🏪 Existing Business</span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">Already running — add only your opening stock (via Purchase Entry) and renovation costs here.</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── BALANCE OVERVIEW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-primary flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Owner Capital
          </p>
          <p className="text-xl font-bold font-mono text-foreground">{fmt(data.ownerCapital)}</p>
          <p className="text-[10px] text-muted-foreground">Equity invested</p>
        </div>
        <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/50 space-y-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Fixed Assets
          </p>
          <p className="text-xl font-bold font-mono text-foreground">{fmt(totalFixedAssets)}</p>
          <p className="text-[10px] text-muted-foreground">{data.fixedAssets.filter(a => a.name && Number(a.amount) > 0).length} items</p>
        </div>
        <div className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/20 space-y-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-destructive flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5" /> Bank Loans
          </p>
          <p className="text-xl font-bold font-mono text-destructive">{fmt(totalLoans)}</p>
          <p className="text-[10px] text-muted-foreground">Liabilities</p>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
          <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Opening Stock
          </p>
          <p className="text-xl font-bold font-mono text-emerald-600">{fmt(effectiveOpeningStock)}</p>
          <p className="text-[10px] text-muted-foreground">
            {openingStockFromPurchases > 0 ? "From purchases ✓" : "Manual entry"}
          </p>
        </div>
      </div>

      {/* ── BALANCE SHEET PREVIEW ── */}
      <Card className="border-border/60 rounded-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-emerald-500" />
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" /> Capital Account Summary (Balance Sheet View)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sources of Funds */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border/40 pb-1">📥 Sources of Funds</p>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Owner's Capital:</span>
                  <span className="font-bold text-primary">{fmt(data.ownerCapital)}</span>
                </div>
                {totalLoans > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank Loans (Liabilities):</span>
                    <span className="font-bold text-destructive">{fmt(totalLoans)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-border/40 font-bold">
                  <span>Total Capital Available:</span>
                  <span className="text-foreground">{fmt(totalInvestment)}</span>
                </div>
              </div>
            </div>
            {/* Application of Funds */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-500 border-b border-border/40 pb-1">📤 Application of Funds</p>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fixed Assets:</span>
                  <span className="font-bold">{fmt(totalFixedAssets)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opening Stock:</span>
                  <span className="font-bold">{fmt(effectiveOpeningStock)}</span>
                </div>
                {totalRenovations > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Renovation / Setup:</span>
                    <span className="font-bold">{fmt(totalRenovations)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-border/40 font-bold">
                  <span>Total Applied:</span>
                  <span className="text-foreground">{fmt(totalApplicationOfFunds)}</span>
                </div>
                <div className={cn("flex justify-between font-bold", workingCapital >= 0 ? "text-emerald-500" : "text-destructive")}>
                  <span>Working Capital (Balance):</span>
                  <span>{fmt(workingCapital)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── OWNER CAPITAL ── */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Owner's Capital Investment
          </CardTitle>
          <CardDescription className="text-xs">Total money the owner has personally put into this business</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="relative max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
            <Input
              type="number"
              min={0}
              placeholder="e.g. 500000"
              className="pl-8 h-11 text-base font-bold font-mono rounded-xl"
              value={data.ownerCapital}
              onChange={e => setData(d => ({ ...d, ownerCapital: e.target.value }))}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            This is the total cash/assets the owner brought into the business from their personal savings, family, or partners.
          </p>
        </CardContent>
      </Card>

      {/* ── FIXED ASSETS — shown for all business types ── */}
      {(data.businessType === "new" || data.businessType === "existing") && (
        <Card className="border-border/60 rounded-2xl">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-500" /> Fixed Assets
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {data.businessType === "new"
                    ? "Computers, furniture, interior decoration, machinery bought to set up the shop"
                    : "Major new purchases like renovation, equipment added to the business"}
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setShowAssetsDetail(p => !p)}
                className="text-muted-foreground hover:text-foreground"
              >
                {showAssetsDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </CardHeader>

          {showAssetsDetail && (
            <CardContent className="p-4 pt-0 space-y-3">
              {data.fixedAssets.map((asset, idx) => (
                <div key={asset.id} className="p-3 rounded-xl border border-border/50 bg-secondary/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">ASSET #{idx + 1}</span>
                    {data.fixedAssets.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive/40 hover:text-destructive"
                        onClick={() => removeAsset(asset.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-bold">Asset Name *</Label>
                      <Input
                        placeholder="e.g. Dell Laptop, Show Rack"
                        className="h-8 text-xs rounded-lg"
                        value={asset.name}
                        onChange={e => updateAsset(asset.id, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-bold">Category</Label>
                      <Select value={asset.category} onValueChange={v => updateAsset(asset.id, "category", v)}>
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSET_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase font-bold">Amount (₹) *</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">₹</span>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          className="h-8 text-xs rounded-lg pl-5 font-mono font-bold"
                          value={asset.amount}
                          onChange={e => updateAsset(asset.id, "amount", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAsset}
                className="text-xs rounded-xl border-dashed h-8 w-full gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Fixed Asset
              </Button>
              {totalFixedAssets > 0 && (
                <div className="text-right text-xs font-bold font-mono text-primary">
                  Total Fixed Assets: {fmt(totalFixedAssets)}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── OPENING STOCK ── */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-500" /> Opening Stock
          </CardTitle>
          <CardDescription className="text-xs">
            {data.businessType === "new"
              ? "Initial stock purchased to start the business. Add items via Purchase Entry page with the 'Opening Stock' checkbox."
              : "Existing inventory value when you started using ShopX. Enter manually below or add via Purchase Entry."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          {/* From Purchases indicator */}
          {openingStockFromPurchases > 0 ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className="text-xs font-bold text-emerald-600">Auto-calculated from Purchase Entry</p>
                  <p className="text-[10px] text-muted-foreground">Items marked "Opening Stock" in Purchase Entry</p>
                </div>
              </div>
              <span className="font-mono font-bold text-emerald-600 text-sm">{fmt(openingStockFromPurchases)}</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-secondary/20 border border-border/40 flex items-start gap-2">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-bold text-foreground">How to add opening stock</p>
                <p>Go to <strong>Purchases → Purchase Entry</strong> and check the <strong>"Opening Stock"</strong> checkbox on each item — the total will automatically appear here.</p>
                <p className="mt-1">Or enter a manual lump-sum below if you don't want to enter item-by-item.</p>
              </div>
            </div>
          )}

          {/* Manual entry (only if no purchase-based stock, or for existing biz lump sum) */}
          {openingStockFromPurchases === 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Manual Opening Stock Value (₹)</Label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="Total value of existing inventory"
                  className="pl-8 h-10 text-sm font-mono font-bold rounded-xl"
                  value={data.openingStockManual}
                  onChange={e => setData(d => ({ ...d, openingStockManual: e.target.value }))}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Use this only if you are not entering items one-by-one in Purchase Entry.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── BANK LOANS / LIABILITIES ── */}
      {data.businessType === "new" && (
        <Card className="border-border/60 rounded-2xl">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-destructive" /> Bank Loans & Liabilities
                </CardTitle>
                <CardDescription className="text-xs">Any loans taken to fund this business (business loan, term loan, etc.)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {data.bankLoans.length === 0 && (
                  <Button type="button" variant="outline" size="sm" className="text-xs rounded-xl h-7 gap-1" onClick={addLoan}>
                    <Plus className="w-3 h-3" /> Add Loan
                  </Button>
                )}
                <button type="button" onClick={() => setShowLoansDetail(p => !p)} className="text-muted-foreground hover:text-foreground">
                  {showLoansDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </CardHeader>

          {showLoansDetail && (
            <CardContent className="p-4 pt-0 space-y-3">
              {data.bankLoans.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/50 text-center text-xs text-muted-foreground">
                  No loans added. Click "Add Loan" above to record a bank loan.
                </div>
              ) : (
                <>
                  {data.bankLoans.map((loan, idx) => (
                    <div key={loan.id} className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-destructive font-mono">LOAN #{idx + 1}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive/40 hover:text-destructive"
                          onClick={() => removeLoan(loan.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Bank / Lender Name *</Label>
                          <Input
                            placeholder="e.g. SBI Business Loan, HDFC"
                            className="h-8 text-xs rounded-lg"
                            value={loan.bankName}
                            onChange={e => updateLoan(loan.id, "bankName", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Loan Amount (₹) *</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">₹</span>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              className="h-8 text-xs rounded-lg pl-5 font-mono font-bold"
                              value={loan.loanAmount}
                              onChange={e => updateLoan(loan.id, "loanAmount", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Interest Rate (%)</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 12"
                            className="h-8 text-xs rounded-lg font-mono"
                            value={loan.interestRate}
                            onChange={e => updateLoan(loan.id, "interestRate", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Start Date</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs rounded-lg"
                            value={loan.startDate}
                            onChange={e => updateLoan(loan.id, "startDate", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Note (Optional)</Label>
                          <Input
                            placeholder="EMI, purpose, etc."
                            className="h-8 text-xs rounded-lg"
                            value={loan.note}
                            onChange={e => updateLoan(loan.id, "note", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLoan} className="text-xs rounded-xl border-dashed h-8 w-full gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Another Loan
                  </Button>
                  {totalLoans > 0 && (
                    <div className="text-right text-xs font-bold font-mono text-destructive">
                      Total Liabilities: {fmt(totalLoans)}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── RENOVATIONS — primarily for existing businesses ── */}
      {data.businessType === "existing" && (
        <Card className="border-border/60 rounded-2xl">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-500" /> Renovation & Capital Improvements
                </CardTitle>
                <CardDescription className="text-xs">Major renovation or improvement costs added to the business</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {data.renovations.length === 0 && (
                  <Button type="button" variant="outline" size="sm" className="text-xs rounded-xl h-7 gap-1" onClick={addReno}>
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                )}
                <button type="button" onClick={() => setShowRenovationsDetail(p => !p)} className="text-muted-foreground hover:text-foreground">
                  {showRenovationsDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </CardHeader>

          {showRenovationsDetail && (
            <CardContent className="p-4 pt-0 space-y-3">
              {data.renovations.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border/50 text-center text-xs text-muted-foreground">
                  No renovation entries. Click "Add" above.
                </div>
              ) : (
                <>
                  {data.renovations.map((reno, idx) => (
                    <div key={reno.id} className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-600 font-mono">RENOVATION #{idx + 1}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive/40 hover:text-destructive"
                          onClick={() => removeReno(reno.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Description *</Label>
                          <Input
                            placeholder="e.g. Shop interior redesign, AC installation"
                            className="h-8 text-xs rounded-lg"
                            value={reno.description}
                            onChange={e => updateReno(reno.id, "description", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Amount (₹) *</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">₹</span>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              className="h-8 text-xs rounded-lg pl-5 font-mono font-bold"
                              value={reno.amount}
                              onChange={e => updateReno(reno.id, "amount", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Date</Label>
                          <Input
                            type="date"
                            className="h-8 text-xs rounded-lg"
                            value={reno.date}
                            onChange={e => updateReno(reno.id, "date", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addReno} className="text-xs rounded-xl border-dashed h-8 w-full gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Add Another Renovation
                  </Button>
                  {totalRenovations > 0 && (
                    <div className="text-right text-xs font-bold font-mono text-amber-600">
                      Total Renovations: {fmt(totalRenovations)}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ── NOTES ── */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" /> Additional Notes (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <textarea
            className="w-full h-20 text-xs rounded-xl border border-border/50 bg-secondary/20 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Any additional details about your capital structure, partners, funding sources..."
            value={data.notes}
            onChange={e => setData(d => ({ ...d, notes: e.target.value }))}
          />
        </CardContent>
      </Card>

      {/* ── SAVE BUTTON ── */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl gap-2"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Capital Account Saved!" : "Save Capital Account"}
        </Button>
      </div>
    </div>
  )
}

