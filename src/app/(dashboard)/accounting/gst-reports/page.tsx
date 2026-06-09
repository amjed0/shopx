"use client"

import * as React from "react"
import {
  FileText,
  Search,
  Download,
  Printer,
  TrendingUp,
  AlertCircle,
  ReceiptText,
  ChevronDown,
  RefreshCw,
  X,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string
  gstin: string
  party: string
  invoiceNo: string
  date: string
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
  type: "B2B" | "B2C" | "Export"
  status: "Filed" | "Pending" | "Draft"
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const invoices: Invoice[] = [
  { id: "1", gstin: "29ABCDE1234F1Z5", party: "Reliance Industries Ltd",   invoiceNo: "INV-2024-001", date: "2024-04-05", taxable: 120000, cgst: 10800, sgst: 10800, igst: 0,     total: 141600, type: "B2B",    status: "Filed"   },
  { id: "2", gstin: "27FGHIJ5678K2Z3", party: "Tata Consultancy Services", invoiceNo: "INV-2024-002", date: "2024-04-12", taxable: 85000,  cgst: 7650,  sgst: 7650,  igst: 0,     total: 100300, type: "B2B",    status: "Filed"   },
  { id: "3", gstin: "",                party: "Retail Customer",           invoiceNo: "INV-2024-003", date: "2024-04-18", taxable: 15000,  cgst: 1350,  sgst: 1350,  igst: 0,     total: 17700,  type: "B2C",    status: "Filed"   },
  { id: "4", gstin: "24KLMNO9012P3Z1", party: "Infosys Limited",           invoiceNo: "INV-2024-004", date: "2024-04-22", taxable: 200000, cgst: 0,     sgst: 0,     igst: 36000, total: 236000, type: "B2B",    status: "Pending" },
  { id: "5", gstin: "",                party: "Export Client USA",         invoiceNo: "INV-2024-005", date: "2024-05-02", taxable: 95000,  cgst: 0,     sgst: 0,     igst: 0,     total: 95000,  type: "Export", status: "Filed"   },
  { id: "6", gstin: "07PQRST3456Q4Z8", party: "Wipro Technologies",        invoiceNo: "INV-2024-006", date: "2024-05-08", taxable: 62000,  cgst: 5580,  sgst: 5580,  igst: 0,     total: 73160,  type: "B2B",    status: "Draft"   },
  { id: "7", gstin: "19UVWXY7890R5Z2", party: "HCL Technologies",          invoiceNo: "INV-2024-007", date: "2024-05-15", taxable: 175000, cgst: 0,     sgst: 0,     igst: 31500, total: 206500, type: "B2B",    status: "Filed"   },
  { id: "8", gstin: "",                party: "Walk-in Customer",          invoiceNo: "INV-2024-008", date: "2024-05-20", taxable: 8500,   cgst: 765,   sgst: 765,   igst: 0,     total: 10030,  type: "B2C",    status: "Filed"   },
]

const monthlyData = [
  { month: "Jan", cgst: 18500, sgst: 18500, igst: 22000, taxable: 330000 },
  { month: "Feb", cgst: 22100, sgst: 22100, igst: 18500, taxable: 380000 },
  { month: "Mar", cgst: 19800, sgst: 19800, igst: 31500, taxable: 410000 },
  { month: "Apr", cgst: 25800, sgst: 25800, igst: 36000, taxable: 520000 },
  { month: "May", cgst: 6345,  sgst: 6345,  igst: 31500, taxable: 340500 },
]

const pieData = [
  { name: "B2B",    value: 642000, color: "hsl(var(--primary))" },
  { name: "B2C",    value: 23500,  color: "hsl(var(--accent))"  },
  { name: "Export", value: 95000,  color: "#22c55e"             },
]

// ─── Utility ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

const fmtShort = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n / 1000).toFixed(0)}K`

function downloadCSV(data: Invoice[]) {
  const headers = ["Invoice No","Date","Party","GSTIN","Type","Taxable","CGST","SGST","IGST","Total","Status"]
  const rows = data.map(i => [i.invoiceNo, i.date, i.party, i.gstin, i.type, i.taxable, i.cgst, i.sgst, i.igst, i.total, i.status])
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = "gst_report.csv"; a.click()
}

// ─── Status / Type Badge helpers ─────────────────────────────────────────────

function StatusBadge({ status }: { status: Invoice["status"] }) {
  if (status === "Filed")   return <Badge className="bg-accent/20 text-accent border-accent/30 rounded-full text-[10px] font-bold uppercase">Filed</Badge>
  if (status === "Pending") return <Badge variant="destructive" className="rounded-full text-[10px] font-bold uppercase">Pending</Badge>
  return <Badge variant="secondary" className="rounded-full text-[10px] font-bold uppercase opacity-60">Draft</Badge>
}

function TypeChip({ type }: { type: Invoice["type"] }) {
  const cls = {
    B2B:    "bg-primary/10 text-primary border border-primary/20",
    B2C:    "bg-accent/10  text-accent  border border-accent/20",
    Export: "bg-green-500/10 text-green-600 border border-green-500/20",
  }[type]
  return <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full", cls)}>{type}</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GSTReportPage() {
  const [activeTab, setActiveTab]       = React.useState<"overview" | "gstr1" | "gstr3b">("overview")
  const [searchQuery, setSearchQuery]   = React.useState("")
  const [typeFilter, setTypeFilter]     = React.useState("All")
  const [statusFilter, setStatusFilter] = React.useState("All")
  const [selectedPeriod, setSelectedPeriod] = React.useState("FY 2024-25 Q1")

  const totalTaxable = invoices.reduce((s, i) => s + i.taxable, 0)
  const totalCGST    = invoices.reduce((s, i) => s + i.cgst, 0)
  const totalSGST    = invoices.reduce((s, i) => s + i.sgst, 0)
  const totalIGST    = invoices.reduce((s, i) => s + i.igst, 0)
  const totalTax     = totalCGST + totalSGST + totalIGST

  const pendingCount = invoices.filter(i => i.status === "Pending").length

  const filtered = invoices.filter(inv => {
    const q = searchQuery.toLowerCase()
    const matchSearch = inv.party.toLowerCase().includes(q) || inv.invoiceNo.toLowerCase().includes(q) || inv.gstin.toLowerCase().includes(q)
    const matchType   = typeFilter   === "All" || inv.type   === typeFilter
    const matchStatus = statusFilter === "All" || inv.status === statusFilter
    return matchSearch && matchType && matchStatus
  })

  const tabs = [
    { key: "overview" as const, label: "Dashboard"          },
    { key: "gstr1"    as const, label: "GSTR-1 (Outward)"   },
    { key: "gstr3b"   as const, label: "GSTR-3B (Summary)"  },
  ]

  return (
    <div className="space-y-8">

      {/* ── Page Header — mirrors Inventory Vault header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground">GST Reports</h1>
          <p className="text-muted-foreground">View, analyse, and export your GST returns.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-44 rounded-full bg-secondary/30 border-none text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["FY 2024-25 Q1","FY 2024-25 Q2","FY 2023-24 Q4","FY 2023-24 Full Year"].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="rounded-full gap-2 px-5" onClick={() => downloadCSV(invoices)}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button className="bg-primary rounded-full px-6 gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* ── Summary Cards — mirrors Inventory stat cards ── */}
      <div className="grid gap-6 lg:grid-cols-4 sm:grid-cols-2">
        <Card className="p-4 flex items-center gap-4 border-none bg-card shadow-sm">
          <ReceiptText className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Taxable Turnover</p>
            <p className="text-2xl font-bold">{fmtShort(totalTaxable)}</p>
            <p className="text-[10px] text-muted-foreground">{invoices.length} invoices</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-none bg-card shadow-sm">
          <TrendingUp className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Tax</p>
            <p className="text-2xl font-bold">{fmtShort(totalTax)}</p>
            <p className="text-[10px] text-muted-foreground">CGST + SGST + IGST</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border-none bg-card shadow-sm">
          <FileText className="text-accent" />
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">IGST Payable</p>
            <p className="text-2xl font-bold text-accent">{fmtShort(totalIGST)}</p>
            <p className="text-[10px] text-muted-foreground">Integrated Tax</p>
          </div>
        </Card>

        <Card
          className={cn(
            "p-4 flex items-center gap-4 cursor-pointer transition-all border-none shadow-sm",
            pendingCount > 0 ? "bg-destructive/10 ring-2 ring-destructive" : "bg-card hover:bg-muted/50"
          )}
        >
          <AlertCircle className="text-destructive" />
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Pending Returns</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{pendingCount}</p>
              {pendingCount > 0 && <Badge variant="destructive" className="text-[8px] h-4">ACTION NEEDED</Badge>}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 border-b border-border/50">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors",
              activeTab === t.key
                ? "bg-card border border-b-card border-border/50 -mb-px text-primary font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ DASHBOARD TAB ══════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Monthly Bar Chart */}
            <Card className="lg:col-span-2 border-none bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-headline text-base">Monthly Tax Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="cgst" name="CGST" fill="hsl(var(--primary))"  radius={[3,3,0,0]} />
                    <Bar dataKey="sgst" name="SGST" fill="hsl(var(--accent))"   radius={[3,3,0,0]} />
                    <Bar dataKey="igst" name="IGST" fill="hsl(var(--primary)/0.4)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie */}
            <Card className="border-none bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-headline text-base">Supply Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="name">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {pieData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                        <span className="text-muted-foreground font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold text-foreground">{fmtShort(d.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Turnover Line */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline text-base">Taxable Turnover — Monthly</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="taxable" name="Taxable Value" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick filed/pending/draft summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Filed",   count: invoices.filter(i=>i.status==="Filed").length,   cls: "text-accent"      },
              { label: "Pending", count: invoices.filter(i=>i.status==="Pending").length, cls: "text-destructive" },
              { label: "Draft",   count: invoices.filter(i=>i.status==="Draft").length,   cls: "text-muted-foreground" },
            ].map(s => (
              <Card key={s.label} className="border-none bg-card shadow-sm p-4 text-center">
                <p className={cn("text-3xl font-bold", s.cls)}>{s.count}</p>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mt-1">{s.label}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ GSTR-1 TAB ══════════ */}
      {activeTab === "gstr1" && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="border-none bg-card shadow-sm">
            <CardContent className="pt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search party, invoice no, GSTIN…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-full bg-secondary/30 border-none"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 rounded-full bg-secondary/30 border-none text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["All","B2B","B2C","Export"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 rounded-full bg-secondary/30 border-none text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["All","Filed","Pending","Draft"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {(searchQuery || typeFilter !== "All" || statusFilter !== "All") && (
                <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setTypeFilter("All"); setStatusFilter("All") }}
                  className="text-xs gap-1 h-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20">
                  <X className="w-3 h-3" /> Clear
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => downloadCSV(filtered)}>
                <Download className="w-3 h-3" /> Export
              </Button>
            </CardContent>
          </Card>

          {/* Invoice Table */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-headline">Invoice Register</CardTitle>
              <Badge variant="secondary" className="rounded-md bg-secondary/50">{filtered.length} Invoices</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="font-bold uppercase text-[10px]">Invoice Info</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Party / GSTIN</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Type</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] text-right">Taxable</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] text-right">CGST</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] text-right">SGST</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] text-right">IGST</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] text-right">Total</TableHead>
                    <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(inv => (
                    <TableRow key={inv.id} className="border-border/30 hover:bg-secondary/10">
                      <TableCell>
                        <p className="font-bold text-sm">{inv.invoiceNo}</p>
                        <p className="text-[10px] font-code uppercase opacity-60">{inv.date}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{inv.party}</p>
                        <p className="text-[10px] font-code opacity-50">{inv.gstin || "—"}</p>
                      </TableCell>
                      <TableCell><TypeChip type={inv.type} /></TableCell>
                      <TableCell className="text-right font-medium">{fmt(inv.taxable)}</TableCell>
                      <TableCell className="text-right text-primary">{inv.cgst ? fmt(inv.cgst) : <span className="opacity-30">—</span>}</TableCell>
                      <TableCell className="text-right text-accent">{inv.sgst ? fmt(inv.sgst) : <span className="opacity-30">—</span>}</TableCell>
                      <TableCell className="text-right text-primary/70">{inv.igst ? fmt(inv.igst) : <span className="opacity-30">—</span>}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(inv.total)}</TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Totals footer */}
              <div className="bg-secondary/30 border-t border-border/30 px-4 py-3 flex flex-wrap gap-4 justify-between text-sm">
                <span className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider self-center">
                  TOTAL — {filtered.length} invoices
                </span>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { label: "Taxable", val: filtered.reduce((s,i)=>s+i.taxable,0), cls: "text-foreground" },
                    { label: "CGST",    val: filtered.reduce((s,i)=>s+i.cgst,0),    cls: "text-primary"    },
                    { label: "SGST",    val: filtered.reduce((s,i)=>s+i.sgst,0),    cls: "text-accent"     },
                    { label: "IGST",    val: filtered.reduce((s,i)=>s+i.igst,0),    cls: "text-primary/70" },
                    { label: "Total",   val: filtered.reduce((s,i)=>s+i.total,0),   cls: "text-foreground font-bold text-base" },
                  ].map(t => (
                    <div key={t.label} className="text-right">
                      <p className="text-[9px] text-muted-foreground font-bold uppercase">{t.label}</p>
                      <p className={cn("font-bold", t.cls)}>{fmt(t.val)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-3">
                  <FileText className="w-12 h-12" />
                  <p className="font-medium">No invoices match your filters.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════ GSTR-3B TAB ══════════ */}
      {activeTab === "gstr3b" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* 3.1 Outward Supplies */}
            <Card className="border-none bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-secondary/20 border-b border-border/30 py-3">
                <CardTitle className="font-headline text-sm">3.1 — Outward Taxable Supplies</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/10">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="font-bold uppercase text-[10px]">Nature</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] text-right">Taxable</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] text-right">IGST</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] text-right">CGST</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] text-right">SGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "(a) Inter-state outward",  taxable: 375000, igst: 67500, cgst: 0,     sgst: 0     },
                      { label: "(b) Intra-state outward",  taxable: 285500, igst: 0,     cgst: 25695, sgst: 25695 },
                      { label: "(c) Zero rated supplies",  taxable: 95000,  igst: 0,     cgst: 0,     sgst: 0     },
                      { label: "(d) Nil rated / Exempt",   taxable: 5000,   igst: 0,     cgst: 0,     sgst: 0     },
                    ].map(row => (
                      <TableRow key={row.label} className="border-border/30 hover:bg-secondary/10">
                        <TableCell className="text-xs text-muted-foreground">{row.label}</TableCell>
                        <TableCell className="text-right font-medium text-sm">{fmt(row.taxable)}</TableCell>
                        <TableCell className="text-right text-primary/70 text-sm">{row.igst ? fmt(row.igst) : <span className="opacity-30">—</span>}</TableCell>
                        <TableCell className="text-right text-primary text-sm">{row.cgst ? fmt(row.cgst) : <span className="opacity-30">—</span>}</TableCell>
                        <TableCell className="text-right text-accent text-sm">{row.sgst ? fmt(row.sgst) : <span className="opacity-30">—</span>}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-primary text-primary-foreground hover:bg-primary">
                      <TableCell className="font-bold text-xs uppercase tracking-wide">Total</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(760500)}</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(67500)}</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(25695)}</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(25695)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* 4. ITC */}
            <Card className="border-none bg-card shadow-sm overflow-hidden">
              <CardHeader className="bg-secondary/20 border-b border-border/30 py-3">
                <CardTitle className="font-headline text-sm">4 — Eligible Input Tax Credit (ITC)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-secondary/10">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="font-bold uppercase text-[10px]">Detail</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] text-right">IGST</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] text-right">CGST</TableHead>
                      <TableHead className="font-bold uppercase text-[10px] text-right">SGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "(A) Import of goods",    igst: 12000, cgst: 0,     sgst: 0     },
                      { label: "(B) Import of services", igst: 5400,  cgst: 0,     sgst: 0     },
                      { label: "(C) Inward from ISD",    igst: 0,     cgst: 3200,  sgst: 3200  },
                      { label: "(D) All other ITC",      igst: 18000, cgst: 14500, sgst: 14500 },
                    ].map(row => (
                      <TableRow key={row.label} className="border-border/30 hover:bg-secondary/10">
                        <TableCell className="text-xs text-muted-foreground">{row.label}</TableCell>
                        <TableCell className="text-right text-primary/70 text-sm">{row.igst ? fmt(row.igst) : <span className="opacity-30">—</span>}</TableCell>
                        <TableCell className="text-right text-primary text-sm">{row.cgst ? fmt(row.cgst) : <span className="opacity-30">—</span>}</TableCell>
                        <TableCell className="text-right text-accent text-sm">{row.sgst ? fmt(row.sgst) : <span className="opacity-30">—</span>}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-accent/80 text-accent-foreground hover:bg-accent/80">
                      <TableCell className="font-bold text-xs uppercase tracking-wide">Net ITC Available</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(35400)}</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(17700)}</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(17700)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Net Payable Summary */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline">6 — Tax Payable Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "IGST",       liability: 67500, itc: 35400, net: 32100 },
                  { label: "CGST",       liability: 25695, itc: 17700, net: 7995  },
                  { label: "SGST/UTGST", liability: 25695, itc: 17700, net: 7995  },
                ].map(col => (
                  <div key={col.label} className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="bg-secondary/30 px-4 py-2 text-center border-b border-border/30">
                      <span className="text-sm font-bold text-foreground">{col.label}</span>
                    </div>
                    <div className="px-4 py-3 space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Tax Liability</span>
                        <span className="font-medium text-foreground">{fmt(col.liability)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>(-) ITC</span>
                        <span className="font-medium text-accent">−{fmt(col.itc)}</span>
                      </div>
                      <div className="border-t border-border/40 pt-2 flex justify-between font-bold text-primary">
                        <span>Net Payable</span>
                        <span className="text-lg">{fmt(col.net)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grand total band */}
              <div className="bg-primary rounded-xl px-6 py-4 flex justify-between items-center">
                <div>
                  <p className="text-primary-foreground/70 text-xs font-bold uppercase tracking-wider">Total GST Payable after ITC</p>
                  <p className="text-primary-foreground text-3xl font-bold mt-0.5">{fmt(32100 + 7995 + 7995)}</p>
                </div>
                <Badge className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30 rounded-full text-xs px-3 py-1">
                  {selectedPeriod}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="border-t border-border/30 pt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Auto-generated report · Data as of {new Date().toLocaleDateString("en-IN")}</span>
        <span className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent" />
          GST Portal Sync Active
        </span>
      </div>
    </div>
  )
}