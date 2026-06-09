"use client"

import * as React from "react"
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, Receipt, Calendar, Download, Loader2,
  BarChart3, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"

interface PLSummary {
  totalRevenue: number
  totalPurchaseOrders: number
  totalInventoryCost: number
  totalExpenses: number
  grossProfit: number
  netProfit: number
  revenueBreakdown: { label: string; amount: number; date: string }[]
  expenseBreakdown: { label: string; amount: number; type: string; date: string }[]
}

const toInputDate = (d: Date) => d.toISOString().slice(0, 10)

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n)

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  })

export default function ProfitLossPage() {
  const { user } = useUser()

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [fromDate, setFromDate] = React.useState(toInputDate(firstOfMonth))
  const [toDate, setToDate] = React.useState(toInputDate(today))
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<PLSummary | null>(null)
  const [error, setError] = React.useState<string | null>(null)  // ← track error

  const applyPreset = (preset: string) => {
    const now = new Date()
    let from: Date
    switch (preset) {
      case "today":   from = new Date(now); break
      case "week":    from = new Date(now); from.setDate(now.getDate() - 7); break
      case "month":   from = new Date(now.getFullYear(), now.getMonth(), 1); break
      case "quarter": from = new Date(now); from.setMonth(now.getMonth() - 3); break
      case "year":    from = new Date(now.getFullYear(), 0, 1); break
      default:        from = new Date(now.getFullYear(), now.getMonth(), 1)
    }
    setFromDate(toInputDate(from))
    setToDate(toInputDate(now))
  }

  const fetchPL = React.useCallback(async () => {
    if (!user?.uid) return   // wait for user, don't throw
    if (!fromDate || !toDate) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      const res = await fetch(`/api/reports/pl?${params}`, {
        headers: { "x-user-id": user.uid },
      })

      // ← read error body instead of just throwing
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = body?.error || `Server error ${res.status}`
        throw new Error(msg)
      }

      const json: PLSummary = await res.json()
      setData(json)
    } catch (err: any) {
      console.error('[fetchPL]', err)
      setError(err.message)
      toast({
        variant: "destructive",
        title: "Error loading P&L",
        description: err.message,
      })
    } finally {
      setLoading(false)
    }
  }, [user?.uid, fromDate, toDate])

  React.useEffect(() => {
    fetchPL()
  }, [fetchPL])

  const handleExport = () => {
    if (!data) return
    const rows = [
      ["P&L Statement", `${fromDate} to ${toDate}`],
      [],
      ["INCOME"],
      ["Source", "Date", "Amount"],
      ...data.revenueBreakdown.map(r => [r.label, r.date, r.amount]),
      [],
      ["EXPENSES"],
      ["Description", "Type", "Date", "Amount"],
      ...data.expenseBreakdown.map(e => [e.label, e.type, e.date, e.amount]),
      [],
      ["SUMMARY"],
      ["Total Revenue", data.totalRevenue],
      ["Purchase Orders", data.totalPurchaseOrders],
      ["Inventory Cost", data.totalInventoryCost],
      ["Other Expenses", data.totalExpenses],
      ["Gross Profit", data.grossProfit],
      ["Net Profit", data.netProfit],
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pl-${fromDate}-to-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const profitColor = (n: number) =>
    n > 0 ? "text-accent" : n < 0 ? "text-destructive" : "text-muted-foreground"

  const profitBg = (n: number) =>
    n > 0 ? "bg-accent/10" : n < 0 ? "bg-destructive/10" : "bg-muted"

  const totalExpensesAll = data
    ? data.totalPurchaseOrders + data.totalInventoryCost + data.totalExpenses
    : 0

  const marginPct = data && data.totalRevenue > 0
    ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1)
    : "0.0"

  return (
    <div className="space-y-8">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground">P&L Statement</h1>
          <p className="text-muted-foreground">Track revenue, expenses and profitability over time.</p>
        </div>
        <Button
          variant="outline"
          className="rounded-full px-6 gap-2"
          onClick={handleExport}
          disabled={!data}
        >
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* DATE RANGE FILTER */}
      <Card className="border-none bg-card shadow-sm">
        <CardContent className="pt-5">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Today", key: "today" },
                { label: "7 Days", key: "week" },
                { label: "This Month", key: "month" },
                { label: "3 Months", key: "quarter" },
                { label: "This Year", key: "year" },
              ].map(p => (
                <Button
                  key={p.key}
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs h-8 bg-secondary/30 hover:bg-primary/10 hover:text-primary"
                  onClick={() => applyPreset(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-3 ml-auto">
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
          </div>
        </CardContent>
      </Card>

      {/* STATES: loading / error / data / empty */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
        </div>
      ) : error ? (
        // ← shows the real error message instead of crashing
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-destructive opacity-70">
          <BarChart3 className="w-12 h-12" />
          <p className="font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPL}>Retry</Button>
        </div>
      ) : data ? (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none bg-card shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Revenue</p>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p>
              <p className="text-[10px] text-muted-foreground">{data.revenueBreakdown.length} transactions</p>
            </Card>

            <Card className="border-none bg-card shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Expenses</p>
                <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                </div>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalExpensesAll)}</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="text-[9px] h-4">PO: {formatCurrency(data.totalPurchaseOrders)}</Badge>
                <Badge variant="secondary" className="text-[9px] h-4">Inv: {formatCurrency(data.totalInventoryCost)}</Badge>
              </div>
            </Card>

            <Card className={cn("border-none shadow-sm p-5 space-y-3", profitBg(data.grossProfit))}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Profit</p>
                <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center">
                  <BarChart3 className={cn("w-4 h-4", profitColor(data.grossProfit))} />
                </div>
              </div>
              <p className={cn("text-2xl font-bold", profitColor(data.grossProfit))}>
                {formatCurrency(data.grossProfit)}
              </p>
              <p className="text-[10px] text-muted-foreground">Revenue − Purchase Orders − Inventory</p>
            </Card>

            <Card className={cn("border-none shadow-sm p-5 space-y-3", profitBg(data.netProfit))}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Profit</p>
                <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center">
                  {data.netProfit > 0
                    ? <ArrowUpRight className="w-4 h-4 text-accent" />
                    : data.netProfit < 0
                    ? <ArrowDownRight className="w-4 h-4 text-destructive" />
                    : <Minus className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
              <p className={cn("text-2xl font-bold", profitColor(data.netProfit))}>
                {formatCurrency(data.netProfit)}
              </p>
              <Badge className={cn(
                "text-[9px] h-4",
                data.netProfit > 0
                  ? "bg-accent/20 text-accent hover:bg-accent/20"
                  : data.netProfit < 0
                  ? "bg-destructive/20 text-destructive hover:bg-destructive/20"
                  : ""
              )}>
                {marginPct}% Margin
              </Badge>
            </Card>
          </div>

          {/* EXPENSE BREAKDOWN CARDS */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Purchase Orders", amount: data.totalPurchaseOrders, icon: ShoppingCart, desc: "Supplier purchase orders" },
              { label: "Inventory Cost",  amount: data.totalInventoryCost,  icon: Package,      desc: "Stock purchase cost" },
              { label: "Other Expenses",  amount: data.totalExpenses,       icon: Receipt,      desc: "Manual / operational expenses" },
            ].map(item => (
              <Card key={item.label} className="border-none bg-card shadow-sm p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-bold">{formatCurrency(item.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* P&L TABLES */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none bg-card shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  <CardTitle className="font-headline text-base">Income</CardTitle>
                  <Badge className="ml-auto bg-accent/10 text-accent hover:bg-accent/10 text-[10px]">
                    {formatCurrency(data.totalRevenue)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.revenueBreakdown.length === 0 ? (
                  <p className="text-center py-10 text-sm text-muted-foreground opacity-50">No income in this period</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="font-bold uppercase text-[10px]">Description</TableHead>
                        <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                        <TableHead className="text-right font-bold uppercase text-[10px]">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.revenueBreakdown.map((r, i) => (
                        <TableRow key={i} className="border-border/30 hover:bg-secondary/10">
                          <TableCell className="font-medium text-sm">{r.label}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(r.date)}</TableCell>
                          <TableCell className="text-right font-bold text-accent">{formatCurrency(r.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="border-none bg-card shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                  <CardTitle className="font-headline text-base">Expenses</CardTitle>
                  <Badge className="ml-auto bg-destructive/10 text-destructive hover:bg-destructive/10 text-[10px]">
                    {formatCurrency(totalExpensesAll)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.expenseBreakdown.length === 0 ? (
                  <p className="text-center py-10 text-sm text-muted-foreground opacity-50">No expenses in this period</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-secondary/20">
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="font-bold uppercase text-[10px]">Description</TableHead>
                        <TableHead className="font-bold uppercase text-[10px]">Type</TableHead>
                        <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                        <TableHead className="text-right font-bold uppercase text-[10px]">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.expenseBreakdown.map((e, i) => (
                        <TableRow key={i} className="border-border/30 hover:bg-secondary/10">
                          <TableCell className="font-medium text-sm">{e.label}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[9px] h-4 uppercase">{e.type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(e.date)}</TableCell>
                          <TableCell className="text-right font-bold text-destructive">{formatCurrency(e.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* SUMMARY TABLE */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  {[
                    { label: "Total Revenue",       amount: data.totalRevenue,          type: "income",  bold: false },
                    { label: "Less: Purchase Orders", amount: -data.totalPurchaseOrders, type: "expense", bold: false },
                    { label: "Less: Inventory Cost", amount: -data.totalInventoryCost,   type: "expense", bold: false },
                    { label: "Gross Profit",         amount: data.grossProfit,           type: "gross",   bold: true  },
                    { label: "Less: Other Expenses", amount: -data.totalExpenses,        type: "expense", bold: false },
                    { label: "Net Profit / Loss",    amount: data.netProfit,             type: "net",     bold: true  },
                  ].map((row, i) => (
                    <TableRow key={i} className={cn("border-border/30", row.bold && "bg-secondary/20")}>
                      <TableCell className={cn("font-medium", row.bold && "font-bold text-base")}>
                        {row.label}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-bold",
                          row.bold && "text-lg",
                          row.type === "income"  ? "text-foreground" :
                          row.type === "expense" ? "text-destructive" :
                          profitColor(row.amount)
                        )}>
                          {row.amount < 0
                            ? `− ${formatCurrency(Math.abs(row.amount))}`
                            : formatCurrency(row.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-3">
          <BarChart3 className="w-12 h-12" />
          <p className="font-medium">Select a date range to view your P&L statement.</p>
        </div>
      )}
    </div>
  )
}