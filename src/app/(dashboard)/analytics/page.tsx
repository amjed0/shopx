"use client"

import * as React from "react"
import {
  BarChart3, TrendingUp, Package, ShoppingCart, ShoppingBag,
  ArrowUpRight, ArrowDownRight, CalendarDays,
  Wallet, AlertTriangle, RefreshCw, Trophy, Zap,
  ChevronLeft, ChevronRight, Receipt, PiggyBank, Info, Scale, FileText,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useUser } from "@/app/auth/use-user"
import {
  BarChart, Bar,
  XAxis, YAxis, Tooltip,
  Cell, PieChart, Pie, Legend, AreaChart, Area,
} from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { AccountsTallyBox } from "@/components/analytics/accounts-tally-box"

// ── Types ─────────────────────────────────────────────────────────────────────
interface KPIs {
  totalRevenue: number
  totalOrders: number
  avgTicket: number
  totalProducts: number
  lowStockCount: number
}
interface DayRevenue   { date: string; label: string; amount: number }
interface MonthRevenue { label: string; amount: number }
interface PaymentData  { method: string; amount: number }
interface CategoryData { name: string; value: number }
interface ProductStat  { name: string; qty: number; revenue: number }
interface AnalyticsData {
  kpis: KPIs
  dailyRevenue: DayRevenue[]
  monthlyRevenue: MonthRevenue[]
  revenueByPayment: PaymentData[]
  categoryData: CategoryData[]
  topProducts: ProductStat[]
  bestSellers: ProductStat[]
}
interface PLData {
  totalRevenue: number
  totalPurchaseOrders: number
  totalExpenses: number
  grossProfit: number
  netProfit: number
}

type ViewMode = "day" | "month" | "year" | "custom" | "all"

// Report pages shown as buttons under the title.
// Change an href here if your page lives at a different URL.
const REPORT_LINKS = [
  { label: "Balance Sheet", href: "/accounting/balance-sheet", icon: Scale },
  { label: "P&L Statement", href: "/accounting/pl-statement", icon: TrendingUp },
  { label: "GST Report",    href: "/accounting/gst-report",    icon: FileText },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ec4899', '#3b82f6',
  '#8b5cf6', '#f97316', '#14b8a6',
]

const pad = (n: number) => String(n).padStart(2, "0")

// Local-time YYYY-MM-DD (avoids the UTC date shifting that toISOString causes)
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ymd(d)
}

const formatDDMMYYYY = (s: string) => {
  const [y, m, d] = s.split("-")
  return y && m && d ? `${d}/${m}/${y}` : s
}

const relativeLabel = (s: string, todayStr: string) => {
  if (s === todayStr) return "Today"
  if (s === daysAgo(1)) return "Yesterday"
  return null
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const RupeeTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-sm">
      <p className="text-muted-foreground mb-1 font-medium">{label ?? payload[0]?.payload?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.payload?.fill }} className="font-bold">{fmt(p.value)}</p>
      ))}
    </div>
  )
}

// ── Indicator box (big money boxes at the top) ───────────────────────────────
function IndicatorBox({
  icon: Icon, label, value, sub, accent, ring, trend,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent: string   // text colour class for icon / value accent
  ring: string     // soft background class
  trend?: "up" | "down" | null
}) {
  return (
    <Card className="border-none bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden relative">
      <div className={cn("absolute inset-x-0 top-0 h-1", ring)} />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between">
          <span className={cn("p-2.5 rounded-xl", ring, accent)}>
            <Icon className="w-5 h-5" />
          </span>
          {trend === "up" && <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
          {trend === "down" && <ArrowDownRight className="w-4 h-4 text-rose-500" />}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-4">{label}</p>
        <p className={cn("text-xl md:text-3xl font-bold font-mono mt-1 tracking-tight truncate", accent)}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Small KPI Card ────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color = 'text-primary', trend,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string
  color?: string; trend?: 'up' | 'down' | null
}) {
  return (
    <Card className="border-none bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 md:p-5 flex flex-col gap-2 md:gap-3">
        <div className="flex items-center justify-between">
          <span className={`p-2 rounded-lg bg-secondary/40 ${color}`}>
            <Icon className="w-4 h-4" />
          </span>
          {trend === 'up'   && <ArrowUpRight   className="w-4 h-4 text-emerald-500" />}
          {trend === 'down' && <ArrowDownRight  className="w-4 h-4 text-rose-500" />}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-lg md:text-2xl font-bold font-mono mt-0.5 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { user } = useUser()
  const router = useRouter()
  const todayStr = React.useMemo(() => ymd(new Date()), [])

  const [data, setData]       = React.useState<AnalyticsData | null>(null)
  const [pl, setPl]           = React.useState<PLData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)
  const [showTally, setShowTally] = React.useState(false)

  // Indian FY: April-start year (e.g. FY 2025-26 → currentFY = 2025)
  const currentFY = React.useMemo(() => {
    const now = new Date()
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  }, [])

  // ── Date filter state (same style as the Sales History page) ──
  const [mode, setMode]               = React.useState<ViewMode>("month")
  const [selectedDate, setSelectedDate]   = React.useState(todayStr)
  const [selectedMonth, setSelectedMonth] = React.useState(todayStr.slice(0, 7))
  const [selectedYear, setSelectedYear]   = React.useState(String(currentFY))
  const [customFrom, setCustomFrom]   = React.useState(daysAgo(29))
  const [customTo, setCustomTo]       = React.useState(todayStr)

  // Final date range sent to the APIs
  const { from, to } = React.useMemo(() => {
    if (mode === "day") return { from: selectedDate, to: selectedDate }
    if (mode === "month") {
      const [y, m] = selectedMonth.split("-").map(Number)
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` }
    }
    if (mode === "year") {
      const fyStart = Number(selectedYear)
      return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` }
    }
    if (mode === "custom") return { from: customFrom, to: customTo }
    return { from: "2000-01-01", to: todayStr }
  }, [mode, selectedDate, selectedMonth, selectedYear, customFrom, customTo, todayStr])

  const fetchData = React.useCallback(async () => {
    if (!from || !to) return
    setLoading(true); setError(null)
    const params = new URLSearchParams({ from, to })
    try {
      const [analyticsRes, plRes] = await Promise.allSettled([
        fetch(`/api/analytics?${params}`, { credentials: "include" }),
        user?.uid
          ? fetch(`/api/pl-statement?${params}`, { headers: { "x-user-id": user.uid }, credentials: "include" })
          : Promise.reject(new Error("no user")),
      ])

      if (analyticsRes.status === "fulfilled" && analyticsRes.value.ok) {
        setData(await analyticsRes.value.json())
      } else {
        let msg = "Failed to fetch"
        if (analyticsRes.status === "fulfilled") {
          msg = (await analyticsRes.value.json().catch(() => ({}))).error || msg
        }
        throw new Error(msg)
      }

      if (plRes.status === "fulfilled" && plRes.value.ok) setPl(await plRes.value.json())
      else setPl(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [from, to, user?.uid])

  React.useEffect(() => { fetchData() }, [fetchData])

  // ── Steppers ──
  const stepDate = (delta: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number)
    const next = ymd(new Date(y, m - 1, d + delta))
    if (next <= todayStr) setSelectedDate(next)
  }
  const stepMonth = (delta: number) => {
    const [y, m] = selectedMonth.split("-").map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    if (next <= todayStr.slice(0, 7)) setSelectedMonth(next)
  }
  const stepYear = (delta: number) => {
    const next = Number(selectedYear) + delta
    if (next <= currentFY) setSelectedYear(String(next))
  }

  const selectedMonthLabel = React.useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
  }, [selectedMonth])

  const rangeText =
    mode === "all" ? "All time"
    : from === to ? formatDDMMYYYY(from)
    : `${formatDDMMYYYY(from)} → ${formatDDMMYYYY(to)}`

  // ── Money figures for the indicator boxes ──
  const sales        = pl?.totalRevenue ?? data?.kpis.totalRevenue ?? 0
  const purchase     = pl?.totalPurchaseOrders ?? 0
  const otherExp     = pl?.totalExpenses ?? 0
  const totalExpense = purchase + otherExp
  const netIncome    = pl ? pl.netProfit : sales - totalExpense
  const margin       = sales > 0 ? (netIncome / sales) * 100 : 0
  const pctOfSales   = (n: number) => (sales > 0 ? `${((n / sales) * 100).toFixed(1)}% of sales` : "—")

  const moneyFlow = [
    { name: "Sales",    amount: sales,        fill: "#6366f1" },
    { name: "Purchase", amount: purchase,     fill: "#f59e0b" },
    { name: "Expenses", amount: totalExpense, fill: "#f43f5e" },
    { name: "Income",   amount: netIncome,    fill: netIncome >= 0 ? "#10b981" : "#be123c" },
  ]

  const tabBtn = (active: boolean) =>
    cn(
      "px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
    )

  const stepperBtn =
    "h-8 w-8 rounded-lg hover:bg-secondary text-foreground hover:text-primary shrink-0 disabled:opacity-20"

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-16">

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge className="bg-primary/10 text-primary border-none mb-2 px-3 py-1 text-[10px] tracking-widest uppercase font-bold">
            Live Analytics
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Business <span className="text-primary">Intelligence</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sales, purchases, expenses and income for <span className="font-semibold text-foreground">{rangeText}</span>.
          </p>
        </div>
      </div>

      {/* ── REPORT & TALLY SHORTCUT BUTTONS ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => setShowTally(prev => !prev)}
          className={cn(
            "h-12 px-5 rounded-2xl gap-2.5 font-bold shadow-md transition-all hover:scale-[1.01] active:scale-[0.99]",
            showTally
              ? "bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white ring-2 ring-emerald-500/50"
              : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/20"
          )}
        >
          <Scale className="w-5 h-5 text-emerald-200" />
          <span>Today Accounts Tally</span>
          <Badge className="bg-white/20 text-white text-[10px] px-2 py-0.5 border-none font-bold">
            {showTally ? "Hide ✕" : "Check Tally ✓"}
          </Badge>
        </Button>

        {REPORT_LINKS.map(link => (
          <Button
            key={link.href}
            type="button"
            variant="outline"
            onClick={() => router.push(link.href)}
            className="h-12 px-5 rounded-2xl gap-2.5 border-border/60 bg-card/60 hover:bg-secondary/60 font-bold text-foreground shadow-sm"
          >
            <link.icon className="w-5 h-5 text-cyan-400" />
            <span>{link.label}</span>
          </Button>
        ))}
      </div>

      {/* ── TODAY ACCOUNTS TALLY BOX (HIDDEN BY DEFAULT, SHOWN ON TOUCH/CLICK) ── */}
      {showTally && (
        <div id="accounts-tally-section" className="animate-in fade-in slide-in-from-top-3 duration-300">
          <AccountsTallyBox userId={user?.uid} onClose={() => setShowTally(false)} />
        </div>
      )}

      {/* ── DATE FILTER BAR ── */}
      <div className="flex flex-col gap-3 bg-card border border-border/60 p-3 rounded-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Mode tabs */}
          <div className="flex items-center gap-1 bg-secondary/30 border border-border/50 rounded-xl p-1 overflow-x-auto">
            <button type="button" onClick={() => setMode("day")} className={tabBtn(mode === "day")}>Day</button>
            <button type="button" onClick={() => setMode("month")} className={tabBtn(mode === "month")}>Monthly</button>
            <button type="button" onClick={() => setMode("year")} className={tabBtn(mode === "year")}>Yearly</button>
            <button type="button" onClick={() => setMode("custom")} className={tabBtn(mode === "custom")}>Selected Dates</button>
            <button type="button" onClick={() => setMode("all")} className={tabBtn(mode === "all")}>All Dates</button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl border-border/60 text-xs font-bold self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          {/* Day */}
          {mode === "day" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-secondary/30 border border-border/50 rounded-xl p-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => stepDate(-1)} className={stepperBtn} title="Previous Day">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-3 py-0.5 text-center min-w-[150px] relative cursor-pointer" title="Click to pick a date">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs font-bold font-mono">{formatDDMMYYYY(selectedDate)}</span>
                    {relativeLabel(selectedDate, todayStr) && (
                      <Badge className="text-[9px] bg-primary/20 text-primary hover:bg-primary/30 px-1.5 py-0 h-4 font-bold">
                        {relativeLabel(selectedDate, todayStr)}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "short" })}
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    max={todayStr}
                    onChange={e => e.target.value && setSelectedDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => stepDate(1)} disabled={selectedDate >= todayStr} className={stepperBtn} title="Next Day">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              {selectedDate !== todayStr && (
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedDate(todayStr)}
                  className="h-9 px-2.5 text-xs font-bold rounded-xl border-border/60 text-primary">
                  Today
                </Button>
              )}
            </div>
          )}

          {/* Monthly */}
          {mode === "month" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-secondary/30 border border-border/50 rounded-xl p-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => stepMonth(-1)} className={stepperBtn} title="Previous Month">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-3 py-0.5 text-center min-w-[160px] relative cursor-pointer" title="Click to pick a month">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs font-bold font-mono">{selectedMonthLabel}</span>
                    {selectedMonth === todayStr.slice(0, 7) && (
                      <Badge className="text-[9px] bg-primary/20 text-primary px-1.5 py-0 h-4 font-bold">Current</Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">Tap to choose month</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    max={todayStr.slice(0, 7)}
                    onChange={e => e.target.value && setSelectedMonth(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => stepMonth(1)} disabled={selectedMonth >= todayStr.slice(0, 7)} className={stepperBtn} title="Next Month">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Yearly */}
          {mode === "year" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-secondary/30 border border-border/50 rounded-xl p-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => stepYear(-1)} className={stepperBtn} title="Previous Year">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-4 py-0.5 text-center min-w-[130px]">
                  <span className="text-xs font-bold font-mono block">FY {selectedYear}–{String(Number(selectedYear) + 1).slice(2)}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">Apr – Mar</span>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => stepYear(1)} disabled={Number(selectedYear) >= currentFY} className={stepperBtn} title="Next Year">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Selected dates */}
          {mode === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-secondary/30 border border-border/50 rounded-xl px-3 py-1.5 flex-wrap">
                <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">From:</span>
                  <Input
                    type="date"
                    value={customFrom}
                    max={customTo || todayStr}
                    onChange={e => e.target.value && setCustomFrom(e.target.value)}
                    className="h-7 w-36 text-xs font-mono font-bold bg-background"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">To:</span>
                  <Input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    max={todayStr}
                    onChange={e => e.target.value && setCustomTo(e.target.value)}
                    className="h-7 w-36 text-xs font-mono font-bold bg-background"
                  />
                </div>
              </div>
            </div>
          )}

          {/* All */}
          {mode === "all" && (
            <Badge variant="outline" className="text-xs font-mono px-3 py-1 bg-secondary/20">
              All time history
            </Badge>
          )}

          <div className="text-xs text-muted-foreground font-mono">
            Showing <span className="font-bold text-foreground">{rangeText}</span>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-500 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Missing purchase/expense data notice */}
      {!loading && data && !pl && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Purchase and expense figures could not be loaded, so they show as ₹0 and income equals sales.</p>
        </div>
      )}

      {/* ── MONEY INDICATOR BOXES ── */}
      <div className="grid gap-3 md:gap-5 grid-cols-2 lg:grid-cols-4">
        <IndicatorBox
          icon={ShoppingBag}
          label="Total Sale"
          value={data || pl ? fmt(sales) : "—"}
          sub={data ? `${data.kpis.totalOrders} orders` : undefined}
          accent="text-indigo-500"
          ring="bg-indigo-500/10"
          trend={sales > 0 ? "up" : null}
        />
        <IndicatorBox
          icon={Package}
          label="Total Purchase"
          value={data || pl ? fmt(purchase) : "—"}
          sub={pctOfSales(purchase)}
          accent="text-amber-500"
          ring="bg-amber-500/10"
        />
        <IndicatorBox
          icon={Receipt}
          label="Total Expenses"
          value={data || pl ? fmt(totalExpense) : "—"}
          sub={`Purchase ${fmt(purchase)} + Other ${fmt(otherExp)}`}
          accent="text-rose-500"
          ring="bg-rose-500/10"
          trend={totalExpense > 0 ? "down" : null}
        />
        <IndicatorBox
          icon={PiggyBank}
          label="Total Income (Net)"
          value={data || pl ? fmt(netIncome) : "—"}
          sub={`${margin.toFixed(1)}% margin · Sale − Expenses`}
          accent={netIncome >= 0 ? "text-emerald-500" : "text-rose-600"}
          ring={netIncome >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}
          trend={netIncome > 0 ? "up" : netIncome < 0 ? "down" : null}
        />
      </div>

      {/* ── SMALL KPI CARDS ── */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={ShoppingCart}  label="Total Orders"  color="text-violet-500"
          value={data ? data.kpis.totalOrders.toString() : '—'} sub="in selected period" />
        <KpiCard icon={BarChart3}     label="Avg Ticket"    color="text-amber-500"
          value={data ? fmt(data.kpis.avgTicket) : '—'} sub="per order" />
        <KpiCard icon={Package}       label="Products"      color="text-emerald-500"
          value={data ? data.kpis.totalProducts.toString() : '—'} sub="in inventory" />
        <KpiCard icon={AlertTriangle} label="Low Stock"     color="text-rose-500"
          value={data ? data.kpis.lowStockCount.toString() : '—'} sub="need restocking"
          trend={data && data.kpis.lowStockCount > 0 ? 'down' : null} />
      </div>

      {/* ── MONEY FLOW + DAILY REVENUE ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Money flow */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-500 shrink-0" /> Money Flow
            </CardTitle>
            <CardDescription className="text-xs">Sale vs purchase vs expenses vs income.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ amount: { label: 'Amount', color: '#6366f1' } }}
              className="h-[220px] md:h-[260px] w-full"
            >
              <BarChart data={moneyFlow}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip content={<RupeeTooltip />} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={30}>
                  {moneyFlow.map((m, i) => <Cell key={i} fill={m.fill} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Daily Revenue Area Chart */}
        <Card className="lg:col-span-2 border-none bg-card shadow-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" /> Daily Revenue Trend
            </CardTitle>
            <CardDescription className="text-xs">Revenue flow across the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ amount: { label: 'Revenue', color: 'hsl(var(--primary))' } }}
              className="h-[220px] md:h-[260px] w-full"
            >
              <AreaChart data={data?.dailyRevenue || []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" axisLine={false} tickLine={false}
                  tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip content={<RupeeTooltip />} />
                <Area dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2}
                  fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── MONTHLY + PAYMENT ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Monthly Revenue Bar Chart */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-500 shrink-0" /> Monthly Revenue
            </CardTitle>
            <CardDescription className="text-xs">Month-over-month performance overview.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ amount: { label: 'Revenue', color: '#8b5cf6' } }}
              className="h-[200px] md:h-[260px] w-full"
            >
              <BarChart data={data?.monthlyRevenue || []}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip content={<RupeeTooltip />} />
                <Bar dataKey="amount" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={28}>
                  {(data?.monthlyRevenue || []).map((_, i) => (
                    <Cell key={i} fill={i === (data?.monthlyRevenue.length ?? 0) - 1 ? '#6366f1' : '#8b5cf680'} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Revenue by Payment Method */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-500 shrink-0" /> Revenue by Payment Method
            </CardTitle>
            <CardDescription className="text-xs">How customers are paying in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ amount: { label: 'Revenue', color: '#10b981' } }}
              className="h-[200px] md:h-[260px] w-full"
            >
              <BarChart data={data?.revenueByPayment || []}>
                <XAxis dataKey="method" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip content={<RupeeTooltip />} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={36}>
                  {(data?.revenueByPayment || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── TOP PRODUCTS & BEST SELLERS ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Top Products by Quantity — horizontal bar */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 shrink-0" /> Top Products by Units Sold
            </CardTitle>
            <CardDescription className="text-xs">Best-performing products in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ qty: { label: 'Units', color: '#f59e0b' } }}
              className="h-[220px] md:h-[280px] w-full"
            >
              <BarChart data={data?.topProducts || []} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category" dataKey="name"
                  width={90}
                  tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-sm">
                        <p className="font-semibold mb-1">{label}</p>
                        <p className="text-amber-500">{payload[0].value} units</p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="qty" radius={[0, 6, 6, 0]} barSize={16}>
                  {(data?.topProducts || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Best Sellers by Revenue */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-500 shrink-0" /> Best Sellers by Revenue
            </CardTitle>
            <CardDescription className="text-xs">Products generating the most revenue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            {(data?.bestSellers || Array(5).fill(null)).map((item, i) => (
              <div key={i} className="flex items-center gap-2 md:gap-3">
                <span
                  className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold text-white shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium truncate">
                    {item?.name ?? <span className="text-muted-foreground">—</span>}
                  </p>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                    {item && (
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(item.revenue / (data?.bestSellers[0]?.revenue || 1)) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    )}
                  </div>
                </div>
                <span className="text-xs md:text-sm font-mono font-semibold whitespace-nowrap shrink-0">
                  {item ? fmt(item.revenue) : '—'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── CATEGORY DONUT ── */}
      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500 shrink-0" /> Inventory by Category
          </CardTitle>
          <CardDescription className="text-xs">Product distribution across all categories.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <ChartContainer config={{}} className="h-[220px] md:h-[260px] w-full">
            <PieChart>
              <Pie
                data={data?.categoryData || []}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={80}
                paddingAngle={4} dataKey="value"
              >
                {(data?.categoryData || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-sm">
                      <p className="font-semibold">{payload[0].name}</p>
                      <p style={{ color: payload[0].payload.fill }}>{payload[0].value} products</p>
                    </div>
                  ) : null
                }
              />
              <Legend
                iconType="circle" iconSize={7}
                formatter={(v) => <span className="text-[10px] text-muted-foreground">{v}</span>}
              />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

    </div>
  )
}
