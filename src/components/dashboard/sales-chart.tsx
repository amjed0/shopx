"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
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

const chartData = [
  { day: "Mon", sales: 4000, profit: 2400 },
  { day: "Tue", sales: 3000, profit: 1398 },
  { day: "Wed", sales: 2000, profit: 9800 },
  { day: "Thu", sales: 2780, profit: 3908 },
  { day: "Fri", sales: 1890, profit: 4800 },
  { day: "Sat", sales: 2390, profit: 3800 },
  { day: "Sun", sales: 3490, profit: 4300 },
]

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
  profit: {
    label: "Profit",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig

export function SalesChart() {
  return (
    <Card className="border-none bg-card shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-8">
        <div className="grid gap-1">
          <CardTitle className="font-headline text-xl">Revenue Growth</CardTitle>
          <CardDescription className="text-muted-foreground">Weekly sales performance & net profit</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            data={chartData}
            margin={{
              left: -20,
              right: 12,
            }}
          >
            <defs>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sales)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-sales)" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => value}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              className="font-code text-[10px]"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Area
              dataKey="profit"
              type="natural"
              fill="url(#fillProfit)"
              fillOpacity={0.4}
              stroke="var(--color-profit)"
              strokeWidth={2}
              stackId="a"
            />
            <Area
              dataKey="sales"
              type="natural"
              fill="url(#fillSales)"
              fillOpacity={0.4}
              stroke="var(--color-sales)"
              strokeWidth={2}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}