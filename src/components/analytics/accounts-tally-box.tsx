"use client"

import * as React from "react"
import {
  Scale,
  Receipt,
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  Banknote,
  QrCode,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Building2,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"

interface TallyItem {
  id: string
  category: string
  description: string
  amount: number
  paymentMode: string
}

interface TallyData {
  date: string
  openingBalance?: {
    autoCash: number
    autoUpi: number
  }
  today: {
    sales: {
      total: number
      cash: number
      upi: number
      card: number
      digital: number
      credit: number
      count: number
    }
    otherIncome: {
      total: number
      cash: number
      digital: number
      items: TallyItem[]
    }
    expenses: {
      total: number
      cash: number
      digital: number
      items: TallyItem[]
    }
    bankDeposits?: {
      total: number
      items: Array<{ id: string; description: string; amount: number; note: string }>
    }
  }
  allTime: {
    sales: {
      total: number
      cash: number
      upi: number
      card: number
      digital: number
      credit: number
      count: number
    }
    otherIncome: {
      total: number
      cash: number
      digital: number
    }
    expenses: {
      total: number
      cash: number
      digital: number
    }
    bankDepositsTotal?: number
    customerOutstanding: number
    netCashInflow: number
    netDigitalInflow: number
  }
}

interface Props {
  userId?: string
  defaultOpen?: boolean
  onClose?: () => void
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0)

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function AccountsTallyBox({ userId, defaultOpen = true, onClose }: Props) {
  const todayStr = React.useMemo(() => ymd(new Date()), [])
  const [selectedDate, setSelectedDate] = React.useState(todayStr)
  const [viewMode, setViewMode] = React.useState<"today" | "all">("today")

  const [tallyData, setTallyData] = React.useState<TallyData | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [showIncomeList, setShowIncomeList] = React.useState(false)
  const [showExpenseList, setShowExpenseList] = React.useState(false)
  const [showDenominations, setShowDenominations] = React.useState(false)

  // ── Opening balances (persisted in localStorage per date & user) ──
  const cashStorageKey = `shopx_opening_cash_${userId || "guest"}_${selectedDate}`
  const upiStorageKey = `shopx_opening_upi_${userId || "guest"}_${selectedDate}`
  const actualCashStorageKey = `shopx_actual_cash_${userId || "guest"}_${selectedDate}`

  const [openingCash, setOpeningCash] = React.useState<number>(0)
  const [openingUpi, setOpeningUpi] = React.useState<number>(0)
  const [actualCashInput, setActualCashInput] = React.useState<string>("")

  // Denominations counter (500, 200, 100, 50, 20, 10, coins)
  const [denominations, setDenominations] = React.useState<Record<string, number>>({
    "500": 0,
    "200": 0,
    "100": 0,
    "50": 0,
    "20": 0,
    "10": 0,
    "coins": 0,
  })

  // Load opening & actual balances when selected date changes
  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const savedCash = localStorage.getItem(cashStorageKey)
      setOpeningCash(savedCash !== null ? Number(savedCash) || 0 : 0)

      const savedUpi = localStorage.getItem(upiStorageKey)
      setOpeningUpi(savedUpi !== null ? Number(savedUpi) || 0 : 0)

      const savedActual = localStorage.getItem(actualCashStorageKey)
      setActualCashInput(savedActual !== null ? savedActual : "")
    } catch {}
  }, [cashStorageKey, upiStorageKey, actualCashStorageKey])

  // Save changes to opening cash
  const handleOpeningCashChange = (val: number) => {
    setOpeningCash(val)
    try {
      localStorage.setItem(cashStorageKey, String(val))
    } catch {}
  }

  // Save changes to opening UPI
  const handleOpeningUpiChange = (val: number) => {
    setOpeningUpi(val)
    try {
      localStorage.setItem(upiStorageKey, String(val))
    } catch {}
  }

  // Save changes to actual counted cash
  const handleActualCashChange = (val: string) => {
    setActualCashInput(val)
    try {
      localStorage.setItem(actualCashStorageKey, val)
    } catch {}
  }

  // Calculate sum from note denominations
  const updateDenomination = (note: string, count: number) => {
    const validCount = Math.max(0, count)
    const next = { ...denominations, [note]: validCount }
    setDenominations(next)

    const sum =
      (next["500"] || 0) * 500 +
      (next["200"] || 0) * 200 +
      (next["100"] || 0) * 100 +
      (next["50"] || 0) * 50 +
      (next["20"] || 0) * 20 +
      (next["10"] || 0) * 10 +
      (next["coins"] || 0)

    handleActualCashChange(String(sum))
  }

  // ── Fetch Tally Data ──
  const fetchTally = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const headers: Record<string, string> = {}
      if (userId) headers["x-user-id"] = userId

      const res = await fetch(`/api/analytics/tally?date=${selectedDate}`, {
        headers,
        credentials: "include",
      })

      if (res.ok) {
        const json: TallyData = await res.json()
        setTallyData(json)

        // Auto-populate opening cash and opening UPI if user hasn't saved a custom override for this date
        const savedCash = localStorage.getItem(cashStorageKey)
        if (savedCash === null && json.openingBalance) {
          setOpeningCash(json.openingBalance.autoCash || 0)
        }

        const savedUpi = localStorage.getItem(upiStorageKey)
        if (savedUpi === null && json.openingBalance) {
          setOpeningUpi(json.openingBalance.autoUpi || 0)
        }
      } else {
        toast({
          variant: "destructive",
          title: "Failed to load Tally",
          description: "Could not fetch today's account records.",
        })
      }
    } catch (err: any) {
      console.error("Tally fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate, userId])

  React.useEffect(() => {
    fetchTally()
  }, [fetchTally])

  // Steppers for date
  const stepDate = (delta: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number)
    const next = ymd(new Date(y, m - 1, d + delta))
    if (next <= todayStr) setSelectedDate(next)
  }

  // ── Calculations for Today's Tally ──
  const todaySales = tallyData?.today.sales ?? {
    total: 0,
    cash: 0,
    upi: 0,
    card: 0,
    digital: 0,
    credit: 0,
    count: 0,
  }
  const todayOtherIncome = tallyData?.today.otherIncome ?? {
    total: 0,
    cash: 0,
    digital: 0,
    items: [],
  }
  const todayExpenses = tallyData?.today.expenses ?? {
    total: 0,
    cash: 0,
    digital: 0,
    items: [],
  }
  const todayBankDeposits = tallyData?.today.bankDeposits ?? {
    total: 0,
    items: [],
  }

  // 1. Expected Cash in Drawer
  // Opening Cash + Cash Sales + Other Cash Income - Cash Expenses - Cash Deposited to Bank
  const expectedCashInHand =
    openingCash + todaySales.cash + todayOtherIncome.cash - todayExpenses.cash - todayBankDeposits.total

  // 2. Expected Digital / Bank (UPI + Card)
  // Opening Bank + UPI Sales + Card Sales + Other Digital Income + Cash Deposited to Bank - Digital Expenses
  const expectedDigitalBalance =
    openingUpi + todaySales.digital + todayOtherIncome.digital + todayBankDeposits.total - todayExpenses.digital

  // 3. Difference (Actual vs Expected Cash)
  const actualCashNum = actualCashInput.trim() !== "" ? Number(actualCashInput) || 0 : null
  const cashDifference = actualCashNum !== null ? actualCashNum - expectedCashInHand : null

  // ── Copy Tally Report to Clipboard ──
  const handleCopyTallyReport = () => {
    if (!tallyData) return
    const text = `📊 *SHOPX ACCOUNTS TALLY REPORT*
📅 Date: ${selectedDate === todayStr ? "Today (" + selectedDate + ")" : selectedDate}
───────────────────────
🛒 *SALES SUMMARY* (${todaySales.count} Bills)
• Total Sales: ${fmt(todaySales.total)}
  - 💵 Cash Sales: ${fmt(todaySales.cash)}
  - 📱 UPI + Cards: ${fmt(todaySales.digital)} (UPI: ${fmt(todaySales.upi)}, Card: ${fmt(todaySales.card)})
  - 📋 Shop Credit: ${fmt(todaySales.credit)}

💰 *OTHER INCOMES*
• Total Non-Sale Income: ${fmt(todayOtherIncome.total)}
  - Cash: ${fmt(todayOtherIncome.cash)} | Digital: ${fmt(todayOtherIncome.digital)}

📉 *DIRECT SHOP EXPENSES* (Excl. Purchases)
• Total Shop Expenses: ${fmt(todayExpenses.total)}
  - Cash: ${fmt(todayExpenses.cash)} | Digital: ${fmt(todayExpenses.digital)}

───────────────────────
⚖️ *CASH IN DRAWER RECONCILIATION*
• (+) Opening Cash: ${fmt(openingCash)}
• (+) Cash Sales: +${fmt(todaySales.cash)}
• (+) Other Cash Income: +${fmt(todayOtherIncome.cash)}
• (-) Cash Expenses: -${fmt(todayExpenses.cash)}${
  todayBankDeposits.total > 0 ? `\n• (-) Cash Deposited to Bank: -${fmt(todayBankDeposits.total)}` : ""
}
-----------------------
= *EXPECTED CASH*: ${fmt(expectedCashInHand)}
• Actual Counted Cash: ${actualCashNum !== null ? fmt(actualCashNum) : "Not entered"}
• *TALLY STATUS*: ${
      cashDifference === null
        ? "Pending Physical Count"
        : cashDifference === 0
        ? "✓ PERFECTLY TALLIED (₹0 Diff)"
        : cashDifference > 0
        ? `⚠️ SURPLUS (+${fmt(cashDifference)})`
        : `❌ SHORTAGE (${fmt(cashDifference)})`
    }

───────────────────────
🏧 *DIGITAL / UPI RECONCILIATION*
• (+) Opening Digital: ${fmt(openingUpi)}
• (+) UPI + Card Sales: +${fmt(todaySales.digital)}${
  todayBankDeposits.total > 0 ? `\n• (+) Cash Deposited from Drawer: +${fmt(todayBankDeposits.total)}` : ""
}
• (+) Digital Income: +${fmt(todayOtherIncome.digital)}
• (-) Digital Expenses: -${fmt(todayExpenses.digital)}
= *EXPECTED DIGITAL BALANCE*: ${fmt(expectedDigitalBalance)}
───────────────────────
Generated by ShopX POS • ${new Date().toLocaleTimeString()}`

    navigator.clipboard.writeText(text)
    setCopied(true)
    toast({
      title: "Tally Report Copied ✓",
      description: "Daily accounts tally summary copied to clipboard. Ready to paste on WhatsApp!",
    })
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <Card className="border border-border/70 bg-card shadow-lg rounded-2xl overflow-hidden relative">
      {/* Top Gradient Stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

      <CardHeader className="p-4 sm:p-6 pb-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                  Accounts Tally & Register Check
                </CardTitle>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                  Daily Audit
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Verify today&apos;s cash in drawer, digital payments (UPI/Card), direct shop expenses, and opening float
              </CardDescription>
            </div>
          </div>

          {/* Mode Switch: Today vs All Accounts */}
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <div className="flex items-center p-1 bg-secondary/40 border border-border/60 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode("today")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                  viewMode === "today"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Today&apos;s Tally
              </button>
              <button
                type="button"
                onClick={() => setViewMode("all")}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                  viewMode === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All Accounts Tally
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyTallyReport}
              className="h-8 gap-1.5 text-xs font-bold rounded-xl border-border/60 hover:bg-secondary/60"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Report"}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={fetchTally}
              disabled={isLoading}
              className="h-8 w-8 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Refresh Tally"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            </Button>

            {onClose && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                title="Hide / Close Tally Box"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Date Selector for Today's Tally */}
        {viewMode === "today" && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 flex-wrap">
            <div className="flex items-center gap-1.5 bg-secondary/30 border border-border/50 rounded-xl p-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => stepDate(-1)}
                className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-3 py-0.5 text-center min-w-[130px] relative cursor-pointer">
                <span className="text-xs font-bold font-mono">
                  {selectedDate === todayStr ? `Today (${selectedDate})` : selectedDate}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  max={todayStr}
                  onChange={e => e.target.value && setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => stepDate(1)}
                disabled={selectedDate >= todayStr}
                className="h-7 w-7 rounded-lg hover:bg-secondary text-foreground disabled:opacity-20"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {selectedDate !== todayStr && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(todayStr)}
                className="h-7 px-2.5 text-xs font-bold text-primary rounded-lg border-primary/30"
              >
                Jump to Today
              </Button>
            )}

            <span className="text-[11px] text-muted-foreground ml-auto">
              Auto-updating with live sales & expenses
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-6 pt-2 space-y-6">
        {viewMode === "today" ? (
          <>
            {/* ── 1. CORE TRANSACTION INFLOWS & OUTFLOWS (TODAY) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Box 1: Total Sales */}
              <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-primary" /> Today Total Sales
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                    {todaySales.count} Bills
                  </Badge>
                </div>
                <p className="text-2xl font-bold font-mono text-foreground tracking-tight">
                  {fmt(todaySales.total)}
                </p>
                <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>💵 Cash:</span>
                    <span className="font-bold text-foreground font-mono">{fmt(todaySales.cash)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>📱 UPI:</span>
                    <span className="font-bold text-foreground font-mono">{fmt(todaySales.upi)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>💳 Card:</span>
                    <span className="font-bold text-foreground font-mono">{fmt(todaySales.card)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>📋 Credit:</span>
                    <span className="font-bold text-amber-400 font-mono">{fmt(todaySales.credit)}</span>
                  </div>
                </div>
                <div className="pt-1 text-[10px] text-cyan-400 font-bold flex items-center justify-between">
                  <span>Total UPI + Cards:</span>
                  <span className="font-mono">{fmt(todaySales.digital)}</span>
                </div>
              </div>

              {/* Box 2: Other Income */}
              <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Today Other Income
                  </span>
                  {todayOtherIncome.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowIncomeList(prev => !prev)}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-bold"
                    >
                      {todayOtherIncome.items.length} items {showIncomeList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <p className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
                  {fmt(todayOtherIncome.total)}
                </p>
                <div className="pt-2 border-t border-border/40 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>💵 In Cash:</span>
                    <span className="font-bold text-foreground font-mono">{fmt(todayOtherIncome.cash)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>📱 Digital / Bank:</span>
                    <span className="font-bold text-foreground font-mono">{fmt(todayOtherIncome.digital)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 truncate">
                  Direct collections, service fees & other income
                </p>
              </div>

              {/* Box 3: Today Expenses (Direct Shop Only) */}
              <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Today Direct Expenses
                  </span>
                  {todayExpenses.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowExpenseList(prev => !prev)}
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-bold"
                    >
                      {todayExpenses.items.length} items {showExpenseList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>
                <p className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
                  {fmt(todayExpenses.total)}
                </p>
                <div className="pt-2 border-t border-border/40 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>💵 Out from Cash:</span>
                    <span className="font-bold text-foreground font-mono">{fmt(todayExpenses.cash)}</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>📱 Out from Digital:</span>
                    <span className="font-bold text-foreground font-mono">{fmt(todayExpenses.digital)}</span>
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="text-emerald-400 font-bold">✓ Excludes purchases</span>
                  <span>Shop bills only</span>
                </div>
              </div>

              {/* Box 4: Credit Given Today */}
              <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Today Shop Credit
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-400 bg-amber-500/10">
                    Due
                  </Badge>
                </div>
                <p className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
                  {fmt(todaySales.credit)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Uncollected bills booked to customer ledger accounts today
                </p>
                <div className="pt-2 border-t border-border/40 text-[10px] text-muted-foreground flex justify-between items-center">
                  <span>Collection Status:</span>
                  <span className="font-bold text-amber-400">Receivable</span>
                </div>
              </div>
            </div>

            {/* Expandable Lists for Other Incomes / Expenses if requested */}
            {showIncomeList && todayOtherIncome.items.length > 0 && (
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-2 animate-in fade-in">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Today Other Income Breakdown:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {todayOtherIncome.items.map(item => (
                    <div key={item.id} className="p-2 bg-card rounded-lg border border-border/40 text-xs flex justify-between items-center">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-foreground truncate">{item.description || item.category}</p>
                        <p className="text-[10px] text-muted-foreground font-code">{item.category} • {item.paymentMode}</p>
                      </div>
                      <span className="font-mono font-bold text-emerald-400 shrink-0">{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showExpenseList && todayExpenses.items.length > 0 && (
              <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-2 animate-in fade-in">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> Today Direct Shop Expenses Breakdown:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {todayExpenses.items.map(item => (
                    <div key={item.id} className="p-2 bg-card rounded-lg border border-border/40 text-xs flex justify-between items-center">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-foreground truncate">{item.description || item.category}</p>
                        <p className="text-[10px] text-muted-foreground font-code">{item.category} • {item.paymentMode}</p>
                      </div>
                      <span className="font-mono font-bold text-rose-400 shrink-0">{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 2. OPENING BALANCES & RECONCILIATION SECTION ── */}
            <div className="p-4 sm:p-5 rounded-2xl bg-secondary/30 border border-border/60 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    Opening Balances & Closing Reconciliation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Set your morning cash float & bank balance to verify closing drawer tally
                  </p>
                </div>
                <Badge variant="outline" className="text-xs font-mono self-start sm:self-auto bg-card">
                  Auto-Calculated
                </Badge>
              </div>

              {/* Opening Balance Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Cash Float */}
                <div className="p-3.5 bg-card rounded-xl border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="opening-cash" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                      Opening Cash in Drawer
                    </Label>
                    <button
                      type="button"
                      onClick={() => handleOpeningCashChange(tallyData?.openingBalance?.autoCash || 0)}
                      className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                      title="Click to use auto-calculated balance from past history"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Auto: {fmt(tallyData?.openingBalance?.autoCash || 0)}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                    <Input
                      id="opening-cash"
                      type="number"
                      min={0}
                      value={openingCash || ""}
                      placeholder="0"
                      onChange={e => handleOpeningCashChange(Math.max(0, Number(e.target.value) || 0))}
                      className="pl-8 text-sm font-mono font-bold bg-secondary/30 h-10 rounded-xl"
                    />
                  </div>
                </div>

                {/* Opening Bank / UPI */}
                <div className="p-3.5 bg-card rounded-xl border border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="opening-upi" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                      Opening UPI / Bank Balance
                    </Label>
                    <button
                      type="button"
                      onClick={() => handleOpeningUpiChange(tallyData?.openingBalance?.autoUpi || 0)}
                      className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                      title="Click to use auto-calculated balance from past history"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      Auto: {fmt(tallyData?.openingBalance?.autoUpi || 0)}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                    <Input
                      id="opening-upi"
                      type="number"
                      min={0}
                      value={openingUpi || ""}
                      placeholder="0"
                      onChange={e => handleOpeningUpiChange(Math.max(0, Number(e.target.value) || 0))}
                      className="pl-8 text-sm font-mono font-bold bg-secondary/30 h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* ── 3. TALLY CHECKING (CASH VS DIGITAL) ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
                {/* ── LEFT: CASH DRAWER TALLY ── */}
                <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-400" />
                      Cash Drawer Tally Calculation
                    </h4>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">Physical Drawer</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>(+) Opening Cash Float:</span>
                      <span className="text-foreground font-bold">{fmt(openingCash)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>(+) Today Cash Sales:</span>
                      <span className="text-emerald-400 font-bold">+{fmt(todaySales.cash)}</span>
                    </div>
                    {todayOtherIncome.cash > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>(+) Other Cash Income:</span>
                        <span className="text-emerald-400 font-bold">+{fmt(todayOtherIncome.cash)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>(-) Today Cash Expenses:</span>
                      <span className="text-rose-400 font-bold">-{fmt(todayExpenses.cash)}</span>
                    </div>
                    {todayBankDeposits.total > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" /> (-) Cash Deposited to Bank:
                        </span>
                        <span className="text-amber-400 font-bold font-mono">-{fmt(todayBankDeposits.total)}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border/60 flex justify-between items-center text-sm font-bold">
                      <span className="text-primary font-bold">(=) Expected Cash in Hand:</span>
                      <span className="text-primary text-base font-extrabold">{fmt(expectedCashInHand)}</span>
                    </div>
                  </div>

                  {/* Physical Count Input */}
                  <div className="pt-3 border-t border-border/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="actual-cash" className="text-xs font-bold text-foreground">
                        Counted Cash in Drawer:
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowDenominations(prev => !prev)}
                        className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        {showDenominations ? "Hide Notes Counter" : "Notes Counter (Denominations)"}
                      </button>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₹</span>
                      <Input
                        id="actual-cash"
                        type="number"
                        min={0}
                        placeholder="Enter physical cash counted in drawer"
                        value={actualCashInput}
                        onChange={e => handleActualCashChange(e.target.value)}
                        className="pl-8 text-sm font-mono font-bold bg-secondary/20 h-10 rounded-xl"
                      />
                    </div>

                    {/* Denominations Helper Box */}
                    {showDenominations && (
                      <div className="p-3 bg-secondary/30 rounded-xl border border-border/50 space-y-2 animate-in fade-in">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Denomination Counter (Enter count of each note):
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {["500", "200", "100", "50", "20", "10"].map(note => (
                            <div key={note} className="flex items-center gap-1">
                              <span className="w-10 text-[11px] font-mono font-bold text-muted-foreground">₹{note}:</span>
                              <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={denominations[note] || ""}
                                onChange={e => updateDenomination(note, Number(e.target.value) || 0)}
                                className="h-7 text-xs font-mono font-bold bg-card"
                              />
                            </div>
                          ))}
                          <div className="flex items-center gap-1 col-span-2">
                            <span className="w-12 text-[11px] font-mono font-bold text-muted-foreground">Coins:</span>
                            <Input
                              type="number"
                              min={0}
                              placeholder="Total ₹ coins"
                              value={denominations["coins"] || ""}
                              onChange={e => updateDenomination("coins", Number(e.target.value) || 0)}
                              className="h-7 text-xs font-mono font-bold bg-card"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tally Result Status */}
                    {actualCashNum !== null && (
                      <div
                        className={cn(
                          "p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all",
                          cashDifference === 0
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : cashDifference! > 0
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {cashDifference === 0 ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                          )}
                          <div>
                            <p className="font-bold">
                              {cashDifference === 0
                                ? "Accounts Tallied Perfectly ✓"
                                : cashDifference! > 0
                                ? "Cash Drawer Surplus (Excess)"
                                : "Cash Drawer Shortage"}
                            </p>
                            <p className="text-[10px] opacity-80 font-normal">
                              {cashDifference === 0
                                ? "Physical cash matches expected calculation exactly."
                                : cashDifference! > 0
                                ? "Drawer has more cash than recorded in bills & expenses."
                                : "Drawer is missing cash. Check for unrecorded shop expenses."}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm block">
                            {cashDifference! > 0 ? `+${fmt(cashDifference!)}` : fmt(cashDifference!)}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider opacity-70">
                            {cashDifference === 0 ? "0 Difference" : "Difference"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── RIGHT: DIGITAL & BANK (UPI + CARDS) TALLY ── */}
                <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-cyan-400" />
                      Digital (UPI + Cards) Account Tally
                    </h4>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase font-bold">Bank Gateway</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>(+) Opening UPI / Bank:</span>
                      <span className="text-foreground font-bold">{fmt(openingUpi)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>(+) Today UPI Sales:</span>
                      <span className="text-cyan-400 font-bold">+{fmt(todaySales.upi)}</span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>(+) Today Card Sales:</span>
                      <span className="text-cyan-400 font-bold">+{fmt(todaySales.card)}</span>
                    </div>
                    {todayOtherIncome.digital > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>(+) Digital Other Income:</span>
                        <span className="text-emerald-400 font-bold">+{fmt(todayOtherIncome.digital)}</span>
                      </div>
                    )}
                    {todayBankDeposits.total > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" /> (+) Cash Deposited from Drawer:
                        </span>
                        <span className="text-emerald-400 font-bold font-mono">+{fmt(todayBankDeposits.total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>(-) Digital Shop Expenses:</span>
                      <span className="text-rose-400 font-bold">-{fmt(todayExpenses.digital)}</span>
                    </div>
                    <div className="pt-2 border-t border-border/60 flex justify-between items-center text-sm font-bold">
                      <span className="text-cyan-400 font-bold">(=) Expected Digital Closing:</span>
                      <span className="text-cyan-400 text-base font-extrabold">{fmt(expectedDigitalBalance)}</span>
                    </div>
                  </div>

                  {/* Digital Info Box */}
                  <div className="pt-3 border-t border-border/40 p-3 bg-secondary/30 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                      <p className="font-semibold text-foreground">Digital Balance Verification:</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Compare your expected digital balance of <span className="font-mono font-bold text-foreground">{fmt(expectedDigitalBalance)}</span> against your UPI QR app (PhonePe / GPay / Paytm Merchant) and Bank Account settlement statements.
                    </p>
                  </div>

                  {/* Net Summary Bar */}
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                        Total Liquid Funds Expected
                      </p>
                      <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                        {fmt(expectedCashInHand + expectedDigitalBalance)}
                      </p>
                    </div>
                    <Badge className="bg-primary text-primary-foreground font-mono text-xs">
                      Cash + Digital
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* ── 4. ALL ACCOUNTS TALLY VIEW (ALL-TIME OVERVIEW) ── */
          <div className="space-y-5 animate-in fade-in">
            <div className="p-4 bg-secondary/20 rounded-xl border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  All Accounts Comprehensive Tally
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Complete cumulative audit of all historical sales, collections, expenses and customer credit
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-mono bg-card px-2.5 py-1">
                {tallyData?.allTime.sales.count || 0} Total Recorded Invoices
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Lifetime Sales */}
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Lifetime Total Sales
                </span>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {fmt(tallyData?.allTime.sales.total || 0)}
                </p>
                <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/40">
                  <div className="flex justify-between">
                    <span>Cash Sales:</span>
                    <span className="font-mono font-bold text-foreground">{fmt(tallyData?.allTime.sales.cash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>UPI + Cards:</span>
                    <span className="font-mono font-bold text-foreground">{fmt(tallyData?.allTime.sales.digital || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Credit Sales:</span>
                    <span className="font-mono font-bold text-amber-400">{fmt(tallyData?.allTime.sales.credit || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Outstanding Customer Due */}
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Customer Due (Credit Balance)
                </span>
                <p className="text-2xl font-bold font-mono text-amber-400">
                  {fmt(tallyData?.allTime.customerOutstanding || 0)}
                </p>
                <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  Total uncollected balance across all registered customer accounts
                </p>
              </div>

              {/* Lifetime Shop Expenses */}
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Lifetime Direct Expenses
                </span>
                <p className="text-2xl font-bold font-mono text-rose-400">
                  {fmt(tallyData?.allTime.expenses.total || 0)}
                </p>
                <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/40">
                  <div className="flex justify-between">
                    <span>Cash Out:</span>
                    <span className="font-mono font-bold">{fmt(tallyData?.allTime.expenses.cash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Digital Out:</span>
                    <span className="font-mono font-bold">{fmt(tallyData?.allTime.expenses.digital || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Lifetime Other Incomes */}
              <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Lifetime Other Incomes
                </span>
                <p className="text-2xl font-bold font-mono text-emerald-400">
                  {fmt(tallyData?.allTime.otherIncome.total || 0)}
                </p>
                <div className="text-[11px] text-muted-foreground space-y-1 pt-1 border-t border-border/40">
                  <div className="flex justify-between">
                    <span>Cash In:</span>
                    <span className="font-mono font-bold">{fmt(tallyData?.allTime.otherIncome.cash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Digital In:</span>
                    <span className="font-mono font-bold">{fmt(tallyData?.allTime.otherIncome.digital || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cumulative Net Position */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/40">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Cumulative Net Cash Inflow</p>
                  <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    {fmt(tallyData?.allTime.netCashInflow || 0)}
                  </p>
                </div>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                  Cash In Hand Net
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/40">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Cumulative Net Digital Inflow</p>
                  <p className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                    {fmt(tallyData?.allTime.netDigitalInflow || 0)}
                  </p>
                </div>
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 bg-cyan-500/10">
                  Bank / UPI Net
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

