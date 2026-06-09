"use client"

import * as React from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Loader2,
  Trash2,
  Filter,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

import { useRouter } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CashbookEntry {
  id: string
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  paymentMode: string
  note?: string
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const toInputDate = (d: Date) => d.toISOString().slice(0, 10)

// Indian FY: April to March
// FY year label = start year e.g. FY 2024-25 starts April 2024
const getCurrentFY = () => {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return year
}

const getFYRange = (startYear: number) => ({
  from: `${startYear}-04-01`,
  to: `${startYear + 1}-03-31`,
})

const getHalfYearRange = (startYear: number, half: 1 | 2) => {
  if (half === 1) return { from: `${startYear}-04-01`, to: `${startYear}-09-30` }
  return { from: `${startYear}-10-01`, to: `${startYear + 1}-03-31` }
}

const getQuarterRange = (startYear: number, quarter: 1 | 2 | 3 | 4) => {
  const ranges = {
    1: { from: `${startYear}-04-01`, to: `${startYear}-06-30` },
    2: { from: `${startYear}-07-01`, to: `${startYear}-09-30` },
    3: { from: `${startYear}-10-01`, to: `${startYear}-12-31` },
    4: { from: `${startYear + 1}-01-01`, to: `${startYear + 1}-03-31` },
  }
  return ranges[quarter]
}

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March",
]

// Map month name to actual month index (0-based)
const MONTH_INDEX: Record<string, number> = {
  April: 3, May: 4, June: 5, July: 6, August: 7, September: 8,
  October: 9, November: 10, December: 11, January: 0, February: 1, March: 2,
}

const getMonthRange = (fyStartYear: number, monthName: string) => {
  const monthIdx = MONTH_INDEX[monthName]
  const year = monthIdx >= 3 ? fyStartYear : fyStartYear + 1
  const from = new Date(year, monthIdx, 1)
  const to = new Date(year, monthIdx + 1, 0)
  return { from: toInputDate(from), to: toInputDate(to) }
}

// Build last 5 FY years list
const getFYYears = () => {
  const current = getCurrentFY()
  return Array.from({ length: 5 }, (_, i) => current - i)
}

type ViewMode = "date" | "month" | "halfyear" | "quarter" | "year"

// ─── Component ────────────────────────────────────────────────────────────────

export default function CashbookHistoryPage() {
  const { user } = useUser()
  const router = useRouter()

  const fyYears = getFYYears()
  const [viewMode, setViewMode] = React.useState<ViewMode>("month")
  const [selectedFY, setSelectedFY] = React.useState(getCurrentFY())

  // Date range
  const today = new Date()
  const [fromDate, setFromDate] = React.useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [toDate, setToDate] = React.useState(toInputDate(today))

  // Month
  const [selectedMonth, setSelectedMonth] = React.useState(MONTHS[today.getMonth() >= 3 ? today.getMonth() - 3 : today.getMonth() + 9])

  // Half year
  const [selectedHalf, setSelectedHalf] = React.useState<1 | 2>(today.getMonth() >= 3 && today.getMonth() <= 8 ? 1 : 2)

  // Quarter
  const currentQ = (): 1 | 2 | 3 | 4 => {
    const m = today.getMonth()
    if (m >= 3 && m <= 5) return 1
    if (m >= 6 && m <= 8) return 2
    if (m >= 9 && m <= 11) return 3
    return 4
  }
  const [selectedQuarter, setSelectedQuarter] = React.useState<1 | 2 | 3 | 4>(currentQ())

  const [entries, setEntries] = React.useState<CashbookEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [typeFilter, setTypeFilter] = React.useState<"all" | "income" | "expense">("all")

  // ── Compute from/to based on viewMode ─────────────────────────────────────

  const computedRange = React.useMemo(() => {
    switch (viewMode) {
      case "date":   return { from: fromDate, to: toDate }
      case "month":  return getMonthRange(selectedFY, selectedMonth)
      case "halfyear": return getHalfYearRange(selectedFY, selectedHalf)
      case "quarter":  return getQuarterRange(selectedFY, selectedQuarter)
      case "year":   return getFYRange(selectedFY)
    }
  }, [viewMode, fromDate, toDate, selectedFY, selectedMonth, selectedHalf, selectedQuarter])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEntries = React.useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: computedRange.from,
        to: computedRange.to,
        ...(typeFilter !== "all" && { type: typeFilter }),
      })
      const res = await fetch(`/api/cashbook?${params}`, {
        headers: { "x-user-id": user.uid },
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const data: CashbookEntry[] = await res.json()
      setEntries(data)
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Could not load entries." })
    } finally {
      setLoading(false)
    }
  }, [user?.uid, computedRange, typeFilter])

  React.useEffect(() => { fetchEntries() }, [fetchEntries])

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, type: string) => {
    if (!user?.uid) return
    try {
      const res = await fetch(`/api/cashbook?id=${id}&type=${type}`, {
        method: "DELETE",
        headers: { "x-user-id": user.uid },
      })
      if (!res.ok) throw new Error("Failed to delete")
      setEntries(prev => prev.filter(e => e.id !== id))
      toast({ title: "Deleted", description: "Entry removed successfully." })
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Could not delete entry." })
    }
  }

  // ── Derived totals ─────────────────────────────────────────────────────────

  const filtered = entries.filter(e => typeFilter === "all" || e.type === typeFilter)
  const totalIncome = filtered.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0)
  const totalExpense = filtered.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0)
  const balance = totalIncome - totalExpense

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">
            Cashbook <span className="text-accent">History</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            View income &amp; expenses by date, month, quarter or financial year.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl text-[10px] font-bold uppercase tracking-wider"
          onClick={() => router.push("/accounting/cashbook")}
        >
          + New Entry
        </Button>
      </div>

      {/* ── Filter Bar ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardContent className="pt-5 space-y-4">

          {/* View mode tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: "date",     label: "Custom Date" },
              { key: "month",    label: "Month" },
              { key: "halfyear", label: "Half Year" },
              { key: "quarter",  label: "Quarter" },
              { key: "year",     label: "FY Year" },
            ] as { key: ViewMode; label: string }[]).map(v => (
              <Button
                key={v.key}
                size="sm"
                variant={viewMode === v.key ? "default" : "ghost"}
                className={cn(
                  "rounded-full text-xs h-8",
                  viewMode === v.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/30 hover:bg-primary/10 hover:text-primary"
                )}
                onClick={() => setViewMode(v.key)}
              >
                {v.label}
              </Button>
            ))}
          </div>

          {/* Controls based on view mode */}
          <div className="flex flex-wrap gap-3 items-center">

            {/* FY selector — shown for all except custom date */}
            {viewMode !== "date" && (
              <Select value={String(selectedFY)} onValueChange={v => setSelectedFY(Number(v))}>
                <SelectTrigger className="h-8 w-[140px] text-xs bg-secondary/30 border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fyYears.map(y => (
                    <SelectItem key={y} value={String(y)}>
                      FY {y}–{String(y + 1).slice(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Month selector */}
            {viewMode === "month" && (
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 w-[130px] text-xs bg-secondary/30 border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Quarter selector */}
            {viewMode === "quarter" && (
              <Select value={String(selectedQuarter)} onValueChange={v => setSelectedQuarter(Number(v) as 1 | 2 | 3 | 4)}>
                <SelectTrigger className="h-8 w-[180px] text-xs bg-secondary/30 border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 — Apr to Jun</SelectItem>
                  <SelectItem value="2">Q2 — Jul to Sep</SelectItem>
                  <SelectItem value="3">Q3 — Oct to Dec</SelectItem>
                  <SelectItem value="4">Q4 — Jan to Mar</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Custom date range */}
            {viewMode === "date" && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="bg-secondary/30 border-none rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="bg-secondary/30 border-none rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {/* Type filter */}
            <div className="ml-auto flex gap-2">
              {(["all", "income", "expense"] as const).map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant={typeFilter === t ? "default" : "ghost"}
                  className={cn(
                    "rounded-full text-xs h-8 capitalize",
                    typeFilter === t
                      ? t === "income"
                        ? "bg-green-500 text-white hover:bg-green-600"
                        : t === "expense"
                        ? "bg-destructive text-white hover:bg-destructive/90"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary/30 hover:bg-primary/10"
                  )}
                  onClick={() => setTypeFilter(t)}
                >
                  {t === "all" ? "All" : t === "income" ? "Income" : "Expense"}
                </Button>
              ))}
            </div>
          </div>

          {/* Active range label */}
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Showing: {computedRange.from} → {computedRange.to}
          </p>
        </CardContent>
      </Card>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-none bg-card shadow-sm p-4 flex items-center gap-3">
          <div className="bg-green-500/10 p-2.5 rounded-xl">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Income</p>
            <p className="text-2xl font-bold text-green-500">{fmt(totalIncome)}</p>
          </div>
        </Card>

        <Card className="border-none bg-card shadow-sm p-4 flex items-center gap-3">
          <div className="bg-destructive/10 p-2.5 rounded-xl">
            <TrendingDown className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Expense</p>
            <p className="text-2xl font-bold text-destructive">{fmt(totalExpense)}</p>
          </div>
        </Card>

        <Card className={cn("border-none shadow-sm p-4 flex items-center gap-3", balance >= 0 ? "bg-primary/5" : "bg-destructive/5")}>
          <div className={cn("p-2.5 rounded-xl", balance >= 0 ? "bg-primary/10" : "bg-destructive/10")}>
            <IndianRupee className={cn("w-5 h-5", balance >= 0 ? "text-primary" : "text-destructive")} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Net Balance</p>
            <p className={cn("text-2xl font-bold", balance >= 0 ? "text-primary" : "text-destructive")}>{fmt(balance)}</p>
          </div>
        </Card>
      </div>

      {/* ── Entries Table ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-headline text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-accent" />
              Entries
              <Badge variant="secondary" className="text-[10px] ml-1">{filtered.length}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary opacity-40" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-30 gap-2">
              <BarChart3 className="w-10 h-10" />
              <p className="text-sm font-medium">No entries found for this period.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/20">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Type</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Category</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Description</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Payment</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Note</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(entry => (
                  <TableRow key={entry.id} className="border-border/30 hover:bg-secondary/10">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {entry.type === "income" ? (
                        <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/10 text-[9px] gap-1">
                          <ArrowDownCircle className="w-2.5 h-2.5" /> Income
                        </Badge>
                      ) : (
                        <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 text-[9px] gap-1">
                          <ArrowUpCircle className="w-2.5 h-2.5" /> Expense
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[9px] uppercase">{entry.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{entry.description}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.paymentMode}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.note || "—"}</TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      entry.type === "income" ? "text-green-500" : "text-destructive"
                    )}>
                      {entry.type === "expense" ? "− " : "+ "}{fmt(entry.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive/30 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(entry.id, entry.type)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}