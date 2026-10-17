"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export interface ChartSale {
  id: string
  date: string
  total: number
  status?: string
  items?: SaleItem[]
}

export interface ChartProduct {
  id: string
  purchasePrice: number
}

interface SalesChartProps {
  sales?: ChartSale[]
  products?: ChartProduct[]
}

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
  profit: {
    label: "Net Profit",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig

export function SalesChart({ sales = [], products = [] }: SalesChartProps) {
  const [timeRange, setTimeRange] = React.useState<"7d" | "30d">("7d")

  const chartData = React.useMemo(() => {
    const daysCount = timeRange === "7d" ? 7 : 30
    const points: Array<{ day: string; date: string; sales: number; profit: number }> = []

    const prodMap: Record<string, number> = {}
    products.forEach((p) => {
      prodMap[p.id] = p.purchasePrice
    })

    const today = new Date()

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().split("T")[0]
      const dayLabel =
        daysCount === 7
          ? d.toLocaleDateString("en-US", { weekday: "short" })
          : `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`

      const daySales = sales.filter((s) => {
        if (s.status === "returned") return false
        return s.date && s.date.startsWith(dateStr)
      })

      const totalSales = daySales.reduce((acc, s) => acc + (s.total || 0), 0)

      let totalProfit = 0
      daySales.forEach((s) => {
        if (s.items && s.items.length > 0) {
          s.items.forEach((item) => {
            const costPerUnit = prodMap[item.productId] ?? item.price * 0.7
            const profitPerUnit = Math.max(0, item.price - costPerUnit)
            totalProfit += profitPerUnit * (item.quantity || 1)
          })
        } else {
          totalProfit += Math.round((s.total || 0) * 0.25)
        }
      })

      points.push({
        day: dayLabel,
        date: dateStr,
        sales: Math.round(totalSales),
        profit: Math.round(totalProfit),
      })
    }

    return points
  }, [sales, products, timeRange])

  const totalPeriodSales = React.useMemo(
    () => chartData.reduce((acc, d) => acc + d.sales, 0),
    [chartData]
  )

  const totalPeriodProfit = React.useMemo(
    () => chartData.reduce((acc, d) => acc + d.profit, 0),
    [chartData]
  )

  return (
    <Card className="border-none bg-card shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="font-headline text-lg sm:text-xl">Revenue Growth</CardTitle>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold tracking-wider uppercase">
              Live
            </span>
          </div>
          <CardDescription className="text-muted-foreground text-xs sm:text-sm">
            {timeRange === "7d" ? "Past 7 days performance" : "Past 30 days performance"} • Total: ₹
            {totalPeriodSales.toLocaleString()} (Profit: ₹{totalPeriodProfit.toLocaleString()})
          </CardDescription>
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl self-start sm:self-auto border border-border/40">
          <button
            type="button"
            onClick={() => setTimeRange("7d")}
            className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
              timeRange === "7d"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("30d")}
            className={`px-3 py-1 text-xs rounded-lg font-semibold transition-all ${
              timeRange === "30d"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            30 Days
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[280px] sm:h-[300px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              left: -20,
              right: 12,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => value}
              className="text-[11px]"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              className="font-code text-[10px]"
              tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
            />
            <ChartTooltip
              cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={<ChartTooltipContent />}
            />
            <Area
              dataKey="sales"
              type="monotone"
              fill="url(#fillSales)"
              fillOpacity={0.4}
              stroke="var(--color-sales)"
              strokeWidth={2.5}
            />
            <Area
              dataKey="profit"
              type="monotone"
              fill="url(#fillProfit)"
              fillOpacity={0.4}
              stroke="var(--color-profit)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}