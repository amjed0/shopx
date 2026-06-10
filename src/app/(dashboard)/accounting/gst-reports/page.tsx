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
  X,
  FileSpreadsheet,
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

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ── CSV Export ──
function downloadCSV(data: Invoice[]) {
  const headers = ["Invoice No","Date","Party","GSTIN","Type","Taxable","CGST","SGST","IGST","Total","Status"]
  const rows = data.map(i => [i.invoiceNo, i.date, i.party, i.gstin, i.type, i.taxable, i.cgst, i.sgst, i.igst, i.total, i.status])
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = "gst_report.csv"; a.click()
}

// ── Excel Export (HTML-table method — no extra dependency) ──
function downloadExcel(data: Invoice[], period: string) {
  const totalRow = {
    taxable: data.reduce((s, i) => s + i.taxable, 0),
    cgst:    data.reduce((s, i) => s + i.cgst, 0),
    sgst:    data.reduce((s, i) => s + i.sgst, 0),
    igst:    data.reduce((s, i) => s + i.igst, 0),
    total:   data.reduce((s, i) => s + i.total, 0),
  }
  const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/>
<style>
  body{font-family:Calibri,Arial,sans-serif;font-size:11pt}
  h2{font-size:14pt;margin-bottom:2px}
  p.sub{font-size:9pt;color:#64748b;margin-top:0}
  table{border-collapse:collapse;width:100%;margin-top:12px}
  th{background:#1e293b;color:#fff;padding:8px 10px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.5px;border:1px solid #334155}
  td{padding:7px 10px;border:1px solid #e2e8f0;font-size:10pt;vertical-align:middle}
  tr:nth-child(even) td{background:#f8fafc}
  .num{text-align:right}
  .b2b{background:#eff6ff;color:#2563eb;font-weight:700;font-size:9pt;padding:2px 6px;border-radius:4px}
  .b2c{background:#f0fdf4;color:#16a34a;font-weight:700;font-size:9pt;padding:2px 6px;border-radius:4px}
  .exp{background:#fefce8;color:#ca8a04;font-weight:700;font-size:9pt;padding:2px 6px;border-radius:4px}
  .filed{color:#16a34a;font-weight:700}
  .pending{color:#dc2626;font-weight:700}
  .draft{color:#6b7280}
  tfoot td{background:#1e293b;color:#fff;font-weight:700;font-size:10pt;border:1px solid #334155}
  .note{font-size:9pt;color:#94a3b8;margin-top:10px}
</style>
</head>
<body>
<h2>GST Report — ${period}</h2>
<p class="sub">Auto-generated · ${new Date().toLocaleDateString("en-IN")} · ${data.length} invoices</p>
<table>
  <thead><tr>
    <th>Invoice No</th><th>Date</th><th>Party</th><th>GSTIN</th><th>Type</th>
    <th>Taxable (₹)</th><th>CGST (₹)</th><th>SGST (₹)</th><th>IGST (₹)</th><th>Total (₹)</th><th>Status</th>
  </tr></thead>
  <tbody>
  ${data.map(i => `<tr>
    <td><b>${i.invoiceNo}</b></td>
    <td style="font-family:monospace;font-size:9pt">${i.date}</td>
    <td>${i.party}</td>
    <td style="font-family:monospace;font-size:9pt">${i.gstin || "—"}</td>
    <td><span class="${i.type === "B2B" ? "b2b" : i.type === "B2C" ? "b2c" : "exp"}">${i.type}</span></td>
    <td class="num">${inr(i.taxable)}</td>
    <td class="num">${i.cgst ? inr(i.cgst) : "—"}</td>
    <td class="num">${i.sgst ? inr(i.sgst) : "—"}</td>
    <td class="num">${i.igst ? inr(i.igst) : "—"}</td>
    <td class="num"><b>${inr(i.total)}</b></td>
    <td class="${i.status === "Filed" ? "filed" : i.status === "Pending" ? "pending" : "draft"}">${i.status}</td>
  </tr>`).join("")}
  </tbody>
  <tfoot><tr>
    <td colspan="5">TOTAL — ${data.length} invoices</td>
    <td class="num">${inr(totalRow.taxable)}</td>
    <td class="num">${inr(totalRow.cgst)}</td>
    <td class="num">${inr(totalRow.sgst)}</td>
    <td class="num">${inr(totalRow.igst)}</td>
    <td class="num">${inr(totalRow.total)}</td>
    <td></td>
  </tr></tfoot>
</table>
<p class="note">Period: ${period} · Generated by GST Reports Module</p>
</body></html>`

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = `GST_${period.replace(/\s+/g, "_")}.xls`; a.click()
}

// ─── Badge helpers — exact same size/style as Inventory badges ───────────────

function StatusBadge({ status }: { status: Invoice["status"] }) {
  if (status === "Filed")
    return <Badge className="bg-accent/20 text-accent border-accent/30 rounded-full text-[8px] px-1 py-0 h-3 leading-none font-bold uppercase">Filed</Badge>
  if (status === "Pending")
    return <Badge variant="destructive" className="rounded-full text-[8px] px-1 py-0 h-3 leading-none font-bold uppercase">Pending</Badge>
  return <Badge variant="secondary" className="rounded-full text-[8px] px-1 py-0 h-3 leading-none font-bold uppercase opacity-60">Draft</Badge>
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
  const [activeTab, setActiveTab]           = React.useState<"overview" | "gstr1" | "gstr3b">("overview")
  const [searchQuery, setSearchQuery]       = React.useState("")
  const [typeFilter, setTypeFilter]         = React.useState("All")
  const [statusFilter, setStatusFilter]     = React.useState("All")
  const [selectedPeriod, setSelectedPeriod] = React.useState("FY 2024-25 Q1")

  const totalTaxable = invoices.reduce((s, i) => s + i.taxable, 0)
  const totalCGST    = invoices.reduce((s, i) => s + i.cgst, 0)
  const totalSGST    = invoices.reduce((s, i) => s + i.sgst, 0)
  const totalIGST    = invoices.reduce((s, i) => s + i.igst, 0)
  const totalTax     = totalCGST + totalSGST + totalIGST
  const pendingCount = invoices.filter(i => i.status === "Pending").length

  const filtered = React.useMemo(() => invoices.filter(inv => {
    const q = searchQuery.toLowerCase()
    const matchSearch = inv.party.toLowerCase().includes(q) || inv.invoiceNo.toLowerCase().includes(q) || inv.gstin.toLowerCase().includes(q)
    const matchType   = typeFilter   === "All" || inv.type   === typeFilter
    const matchStatus = statusFilter === "All" || inv.status === statusFilter
    return matchSearch && matchType && matchStatus
  }), [searchQuery, typeFilter, statusFilter])

  const tabs = [
    { key: "overview" as const, label: "Dashboard"         },
    { key: "gstr1"    as const, label: "GSTR-1 (Outward)"  },
    { key: "gstr3b"   as const, label: "GSTR-3B (Summary)" },
  ]

  return (
    <div className="space-y-8">

      {/* ── Page Header — identical structure to Inventory Vault ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground">GST Reports</h1>
          <p className="text-muted-foreground">View, analyse, and export your GST returns.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Period selector */}
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

          {/* CSV — outline ghost, matches Inventory secondary actions */}
          <Button variant="outline" className="rounded-full gap-2 px-5" onClick={() => downloadCSV(invoices)}>
            <Download className="w-4 h-4" /> CSV
          </Button>

          {/* Excel — green tinted outline, clearly distinct */}
          <Button
            variant="outline"
            className="rounded-full gap-2 px-5 border-green-600/40 text-green-700 hover:bg-green-600/10 hover:text-green-700"
            onClick={() => downloadExcel(invoices, selectedPeriod)}
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>

          {/* Print — primary, matches "Add Product" button weight */}
          <Button className="bg-primary rounded-full px-6 gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* ── Summary Cards — 4-col grid, border-none, same p-4 + icon pattern ── */}
      <div className="grid gap-6 lg:grid-cols-4">
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

        {/* Pending card — same clickable destructive pattern as Low Stock card */}
        <Card
          className={cn(
            "p-4 flex items-center gap-4 border-none shadow-sm transition-all",
            pendingCount > 0
              ? "bg-destructive/10 ring-2 ring-destructive"
              : "bg-card hover:bg-muted/50"
          )}
        >
          <AlertCircle className="text-destructive" />
          <div>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Pending Returns</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{pendingCount}</p>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-[8px] h-4">ACTION NEEDED</Badge>
              )}
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
                <CardTitle className="font-headline">Monthly Tax Trend</CardTitle>
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
                    <Bar dataKey="cgst" name="CGST" fill="hsl(var(--primary))"       radius={[3,3,0,0]} />
                    <Bar dataKey="sgst" name="SGST" fill="hsl(var(--accent))"        radius={[3,3,0,0]} />
                    <Bar dataKey="igst" name="IGST" fill="hsl(var(--primary)/0.35)"  radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Supply Pie */}
            <Card className="border-none bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-headline">Supply Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" nameKey="name">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
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
              <CardTitle className="font-headline">Taxable Turnover — Monthly</CardTitle>
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

          {/* Filed / Pending / Draft — same stat card style */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Filed",   count: invoices.filter(i => i.status === "Filed").length,   cls: "text-accent"           },
              { label: "Pending", count: invoices.filter(i => i.status === "Pending").length, cls: "text-destructive"      },
              { label: "Draft",   count: invoices.filter(i => i.status === "Draft").length,   cls: "text-muted-foreground" },
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

          {/* Catalog-style card — CardHeader with search + filters, matching Inventory */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="font-headline">Invoice Register</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search pill — same as Inventory "Search..." */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search party, invoice, GSTIN…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-56 pl-9 rounded-full bg-secondary/30 border-none"
                  />
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-28 h-9 rounded-full bg-secondary/30 border-none text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["All","B2B","B2C","Export"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-28 h-9 rounded-full bg-secondary/30 border-none text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["All","Filed","Pending","Draft"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Clear filter — same destructive pill as Inventory */}
                {(searchQuery || typeFilter !== "All" || statusFilter !== "All") && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setSearchQuery(""); setTypeFilter("All"); setStatusFilter("All") }}
                    className="text-xs gap-1 h-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                  >
                    <X className="w-3 h-3" /> Clear
                  </Button>
                )}

                {/* Per-tab Excel export */}
                <Button
                  variant="ghost" size="sm"
                  className="text-xs gap-1 h-8 rounded-full border border-green-600/30 text-green-700 hover:bg-green-600/10"
                  onClick={() => downloadExcel(filtered, selectedPeriod)}
                >
                  <FileSpreadsheet className="w-3 h-3" /> Excel
                </Button>

                <Badge variant="secondary" className="rounded-md bg-secondary/50">{filtered.length} Invoices</Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                {/* TableHeader — same bg-secondary/20, text-[10px] uppercase as Inventory */}
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
                        <p className="font-bold">{inv.invoiceNo}</p>
                        <p className="text-[10px] uppercase font-code opacity-60">{inv.date}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold">{inv.party}</p>
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

              {/* Totals footer — same bg-secondary/30 pattern as Inventory */}
              <div className="bg-secondary/30 border-t border-border/30 px-4 py-3 flex flex-wrap gap-4 justify-between text-sm">
                <span className="font-bold uppercase text-[10px] text-muted-foreground tracking-wider self-center">
                  TOTAL — {filtered.length} invoices
                </span>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { label: "Taxable", val: filtered.reduce((s,i)=>s+i.taxable,0), cls: "text-foreground"                   },
                    { label: "CGST",    val: filtered.reduce((s,i)=>s+i.cgst,0),    cls: "text-primary"                      },
                    { label: "SGST",    val: filtered.reduce((s,i)=>s+i.sgst,0),    cls: "text-accent"                       },
                    { label: "IGST",    val: filtered.reduce((s,i)=>s+i.igst,0),    cls: "text-primary/70"                   },
                    { label: "Total",   val: filtered.reduce((s,i)=>s+i.total,0),   cls: "text-foreground font-bold text-base"},
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
                      { label: "(a) Inter-state outward", taxable: 375000, igst: 67500, cgst: 0,     sgst: 0     },
                      { label: "(b) Intra-state outward", taxable: 285500, igst: 0,     cgst: 25695, sgst: 25695 },
                      { label: "(c) Zero rated supplies", taxable: 95000,  igst: 0,     cgst: 0,     sgst: 0     },
                      { label: "(d) Nil rated / Exempt",  taxable: 5000,   igst: 0,     cgst: 0,     sgst: 0     },
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

          {/* Tax Payable Summary */}
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

              {/* Grand total band — same primary bg pill pattern used elsewhere */}
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
