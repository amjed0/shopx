"use client"

import * as React from "react"
import {
  BarChart3, TrendingUp, Package, ShoppingCart,
  ArrowUpRight, ArrowDownRight, CalendarDays,
  Wallet, AlertTriangle, RefreshCw, Trophy, Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BarChart, Bar, LineChart, Line,
  ResponsiveContainer, XAxis, YAxis, Tooltip,
  Cell, PieChart, Pie, Legend, AreaChart, Area,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ec4899', '#3b82f6',
  '#8b5cf6', '#f97316', '#14b8a6',
]

function today()        { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────
const RupeeTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-xl text-sm">
      <p className="text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">{fmt(p.value)}</p>
      ))}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
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
  const [data, setData]       = React.useState<AnalyticsData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)
  const [from, setFrom]       = React.useState(daysAgo(29))
  const [to, setTo]           = React.useState(today())

  const fetchData = React.useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ from, to })
      const res = await fetch(`/api/analytics?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  React.useEffect(() => { fetchData() }, [fetchData])

  const applyPreset = (days: number) => { setFrom(daysAgo(days - 1)); setTo(today()) }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-16">

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Business <span className="text-primary">Intelligence</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time analytics powered by your MongoDB store data.
          </p>
        </div>

        {/* ── DATE FILTER ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Preset buttons */}
          <div className="flex gap-2">
            {[{ label: '7D', days: 7 }, { label: '30D', days: 30 }, { label: '90D', days: 90 }].map(p => (
              <Button
                key={p.label} variant="outline" size="sm"
                onClick={() => applyPreset(p.days)}
                className="text-xs h-8 flex-1 sm:flex-none"
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Date inputs — stack on mobile, inline on sm+ */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-8 text-xs w-full sm:w-36"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
              type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-8 text-xs w-full sm:w-36"
            />
            <Button size="sm" onClick={fetchData} className="h-8 gap-1.5 w-full sm:w-auto" disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading…' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-500 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* ── KPI CARDS ──
          2 cols mobile → 3 cols sm → 5 cols lg
      ── */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard icon={Wallet}        label="Total Revenue"   color="text-primary"
          value={data ? fmt(data.kpis.totalRevenue) : '—'} trend="up" />
        <KpiCard icon={ShoppingCart}  label="Total Orders"    color="text-violet-500"
          value={data ? data.kpis.totalOrders.toString() : '—'} sub="in selected period" />
        <KpiCard icon={BarChart3}     label="Avg Ticket"      color="text-amber-500"
          value={data ? fmt(data.kpis.avgTicket) : '—'} />
        <KpiCard icon={Package}       label="Products"        color="text-emerald-500"
          value={data ? data.kpis.totalProducts.toString() : '—'} sub="in inventory" />
        <KpiCard icon={AlertTriangle} label="Low Stock"       color="text-rose-500"
          value={data ? data.kpis.lowStockCount.toString() : '—'} sub="need restocking"
          trend={data && data.kpis.lowStockCount > 0 ? 'down' : null} />
      </div>

      {/* ── REVENUE CHARTS ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Daily Revenue Area Chart */}
        <Card className="border-none bg-card shadow-sm">
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="text-sm md:text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" /> Daily Revenue Trend
            </CardTitle>
            <CardDescription className="text-xs">Revenue flow across the selected date range.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ amount: { label: 'Revenue', color: 'hsl(var(--primary))' } }}
              className="h-[200px] md:h-[260px] w-full"
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

      {/* ── DISTRIBUTION CHARTS ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Category Donut */}
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
              className="h-[220px] md:h-[260px] w-full"
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

    </div>
  )
}