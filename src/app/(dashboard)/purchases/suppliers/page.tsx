"use client"

import * as React from "react"
import {
  Truck,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Search,
  Edit2,
  Loader2,
  ArrowLeft,
  Building2,
  Users,
  Download,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useUser } from "@/app/auth/use-user"
import { toast } from "@/hooks/use-toast"

export interface Supplier {
  id: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  createdAt: string
}

export default function SuppliersPage() {
  const router = useRouter()
  const { user } = useUser()
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [showHistory, setShowHistory] = React.useState<string | false>(false)
  const [purchaseHistory, setPurchaseHistory] = React.useState<any[]>([])
  const [historyLoading, setHistoryLoading] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [editingSupplier, setEditingSupplier] = React.useState<Supplier | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)

  // Date-wise Purchase History Filter
  const [selectedDate, setSelectedDate] = React.useState<string | "ALL">("ALL")

  // Export Modal State
  const [isExportOpen, setIsExportOpen] = React.useState(false)
  const [exportData, setExportData] = React.useState<{
    title: string
    subtitle: string
    filename: string
    headers: string[]
    rows: (string | number)[][]
    summary?: { label: string; value: string }[]
  } | null>(null)

  React.useEffect(() => {
    if (!user?.uid) return
    const fetchSuppliers = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/suppliers", {
          headers: { "x-user-id": user.uid },
        })
        if (!res.ok) throw new Error("Failed to fetch suppliers")
        const data = await res.json()
        setSuppliers(data)
      } catch (err) {
        console.error(err)
        toast({ title: "Error", description: "Could not load suppliers.", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    fetchSuppliers()
  }, [user?.uid])

  // Fetch purchase history when a supplier is selected for view
  React.useEffect(() => {
    if (!showHistory || !user?.uid) return
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true)
        setPurchaseHistory([])
        setSelectedDate("ALL")
        const res = await fetch(`/api/purchases?supplierId=${showHistory}`, {
          headers: { "x-user-id": user.uid },
        })

        if (!res.ok) {
          const errText = await res.text()
          console.error("History API error:", res.status, errText)
          throw new Error(`Failed to fetch history: ${res.status} ${errText}`)
        }

        const data = await res.json()
        const sorted = (Array.isArray(data) ? data : []).sort((a: any, b: any) => {
          const dateA = a.billingDate || a.createdAt || ""
          const dateB = b.billingDate || b.createdAt || ""
          return dateB.localeCompare(dateA)
        })
        setPurchaseHistory(sorted)
      } catch (err) {
        console.error(err)
        toast({ title: "Error", description: "Could not load purchase history.", variant: "destructive" })
      } finally {
        setHistoryLoading(false)
      }
    }
    fetchHistory()
  }, [showHistory, user?.uid])

  const filtered = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(
      s =>
        s.name?.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q)
    )
  }, [suppliers, searchQuery])

  const stats = React.useMemo(() => {
    const total = suppliers.length
    const today = new Date().toISOString().split("T")[0]
    const newToday = suppliers.filter(s => s.createdAt?.startsWith(today)).length
    return { total, newToday }
  }, [suppliers])

  const selectedSupplier = suppliers.find(s => s.id === showHistory)

  // Unique billing dates for the active supplier's purchases (sorted descending: newest first)
  const uniqueDates = React.useMemo(() => {
    const dates = Array.from(new Set(purchaseHistory.map(p => {
      return p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "")
    }))).filter(Boolean).sort().reverse()
    return dates
  }, [purchaseHistory])

  // Filtered purchases based on selectedDate or "ALL"
  const displayedPurchases = React.useMemo(() => {
    if (selectedDate === "ALL") return purchaseHistory
    return purchaseHistory.filter(p => {
      const d = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "")
      return d === selectedDate
    })
  }, [purchaseHistory, selectedDate])

  const historyTotalQty = React.useMemo(() => {
    return displayedPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
  }, [displayedPurchases])

  const historyTotalSpend = React.useMemo(() => {
    return displayedPurchases.reduce((acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice) || 0), 0)
  }, [displayedPurchases])

  // Date Stepper Handlers
  const handlePrevDate = () => {
    if (uniqueDates.length === 0) return
    if (selectedDate === "ALL") {
      setSelectedDate(uniqueDates[0])
    } else {
      const currentIdx = uniqueDates.indexOf(selectedDate)
      if (currentIdx < uniqueDates.length - 1) {
        setSelectedDate(uniqueDates[currentIdx + 1])
      }
    }
  }

  const handleNextDate = () => {
    if (uniqueDates.length === 0 || selectedDate === "ALL") return
    const currentIdx = uniqueDates.indexOf(selectedDate)
    if (currentIdx > 0) {
      setSelectedDate(uniqueDates[currentIdx - 1])
    } else if (currentIdx === 0) {
      setSelectedDate("ALL")
    }
  }

  // Export functions
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\r\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: "Excel / CSV Exported ✓", description: `Downloaded ${filename}.csv` })
  }

  const exportToGoogleSheets = (filename: string, headers: string[], rows: (string | number)[][]) => {
    exportToCSV(filename, headers, rows)
    window.open("https://sheets.new", "_blank")
    toast({
      title: "Google Sheets Export ✓",
      description: "Downloaded CSV and opened Google Sheets (use File -> Import -> Upload).",
    })
  }

  const exportToPDF = (
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    summary?: { label: string; value: string }[]
  ) => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({ variant: "destructive", title: "Popup Blocked", description: "Please allow popups to generate PDF report." })
      return
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 24px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 20px; font-weight: bold; color: #0f172a; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
            .date { font-size: 11px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
            th { background: #f8fafc; color: #334155; font-weight: 700; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .text-right { text-align: right; }
            .summary { margin-top: 20px; display: flex; justify-content: flex-end; gap: 24px; font-size: 13px; font-weight: bold; border-top: 2px solid #e2e8f0; padding-top: 12px; }
            .footer { margin-top: 36px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">${title}</div>
              <div class="subtitle">${subtitle}</div>
            </div>
            <div class="date">Report Date: ${new Date().toLocaleDateString()}</div>
          </div>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rows.map(r => `<tr>${r.map((cell) => `<td class="${typeof cell === 'number' || (typeof cell === 'string' && cell.startsWith('₹')) ? 'text-right' : ''}">${cell}</td>`).join("")}</tr>`).join("")}
            </tbody>
          </table>
          ${summary ? `
            <div class="summary">
              ${summary.map(s => `<div>${s.label}: <span style="color: #0284c7;">${s.value}</span></div>`).join("")}
            </div>
          ` : ""}
          <div class="footer">ShopX Elite — Procurement & Inventory System</div>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  // Trigger export for Vendor Directory
  const handleExportSuppliers = () => {
    const headers = ["Vendor Name", "Contact Person", "Phone", "Email", "Address", "Registered Date"]
    const rows = filtered.map(s => [
      s.name || "",
      s.contactPerson || "",
      s.phone || "",
      s.email || "",
      s.address || "",
      s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
    ])
    setExportData({
      title: "Vendor Directory",
      subtitle: `Total ${filtered.length} suppliers registered in ShopX`,
      filename: `Suppliers_Directory_${new Date().toISOString().split("T")[0]}`,
      headers,
      rows,
      summary: [{ label: "Total Vendors", value: String(filtered.length) }],
    })
    setIsExportOpen(true)
  }

  // Trigger export for Supplier's Purchase History
  const handleExportSupplierHistory = () => {
    if (!selectedSupplier) return
    const dateLabel = selectedDate === "ALL" ? "All Dates" : `Date: ${selectedDate}`
    const headers = ["Product Name", "Billing Date", "Quantity", "Purchase Cost (₹)", "Subtotal (₹)"]
    const rows = displayedPurchases.map(p => [
      p.productName || "Product",
      p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : ""),
      Number(p.quantity) || 1,
      `₹${Number(p.purchasePrice || 0).toLocaleString()}`,
      `₹${((Number(p.quantity) || 1) * (Number(p.purchasePrice) || 0)).toLocaleString()}`,
    ])

    setExportData({
      title: `Purchase History — ${selectedSupplier.name}`,
      subtitle: `Vendor: ${selectedSupplier.name} (📞 ${selectedSupplier.phone || "No phone"}) • ${dateLabel}`,
      filename: `Purchases_${selectedSupplier.name.replace(/[^a-zA-Z0-9]/g, "_")}_${selectedDate === "ALL" ? "All" : selectedDate}`,
      headers,
      rows,
      summary: [
        { label: "Total Products", value: String(displayedPurchases.length) },
        { label: "Total Quantity", value: String(historyTotalQty) },
        { label: "Total Spend", value: `₹${historyTotalSpend.toLocaleString()}` },
      ],
    })
    setIsExportOpen(true)
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid) return
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    const supplierData = {
      name: formData.get("name") as string,
      contactPerson: formData.get("contactPerson") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
    }

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify(supplierData),
      })
      if (!res.ok) throw new Error("Failed to add supplier")
      const newSupplier = await res.json()
      setSuppliers(prev => [newSupplier, ...prev])
      toast({ title: "Supplier Added", description: `${supplierData.name} has been registered.` })
      setIsAddOpen(false)
      ;(e.target as HTMLFormElement).reset()
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Could not add supplier.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid || !editingSupplier) return
    setIsSavingEdit(true)
    const formData = new FormData(e.currentTarget)

    const updatedData = {
      name: formData.get("name") as string,
      contactPerson: formData.get("contactPerson") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      address: formData.get("address") as string,
    }

    try {
      const res = await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify(updatedData),
      })
      if (!res.ok) throw new Error("Failed to update supplier")
      const saved = await res.json()
      setSuppliers(prev => prev.map(s => s.id === saved.id ? saved : s))
      toast({ title: "Supplier Updated", description: `${saved.name} details have been saved.` })
      setIsEditOpen(false)
      setEditingSupplier(null)
    } catch (err: any) {
      console.error(err)
      toast({ title: "Update Failed", description: err.message || "Could not update supplier.", variant: "destructive" })
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-secondary"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-headline font-bold text-foreground">
              Suppliers <span className="text-accent">Registry</span>
            </h1>
            <p className="text-muted-foreground">Manage vendor relationships and contact details.</p>
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground gap-2 font-bold px-8 py-6 rounded-full shadow-lg shadow-accent/20">
              <UserPlus className="w-5 h-5" />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Register New Supplier</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1">
                  <Label>Company Name</Label>
                  <Input name="name" placeholder="e.g. TechWholesale Ltd" required />
                </div>
                <div className="space-y-1">
                  <Label>Contact Person</Label>
                  <Input name="contactPerson" placeholder="Full Name" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input name="phone" placeholder="Phone Number" required />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input name="email" type="email" placeholder="email@vendor.com" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Address</Label>
                  <Input name="address" placeholder="Main Office Address" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-accent text-accent-foreground"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {isSubmitting ? "Saving..." : "Initialize Vendor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Supplier Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) setEditingSupplier(null)
        }}>
          <DialogContent>
            {editingSupplier && (
              <form onSubmit={handleEdit}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-accent" />
                    Edit Supplier: {editingSupplier.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-1">
                    <Label>Company Name *</Label>
                    <Input
                      name="name"
                      defaultValue={editingSupplier.name}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Contact Person *</Label>
                    <Input
                      name="contactPerson"
                      defaultValue={editingSupplier.contactPerson}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Phone *</Label>
                      <Input
                        name="phone"
                        defaultValue={editingSupplier.phone}
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Email</Label>
                      <Input
                        name="email"
                        type="email"
                        defaultValue={editingSupplier.email}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Address</Label>
                    <Input
                      name="address"
                      defaultValue={editingSupplier.address}
                    />
                  </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditOpen(false)
                      setEditingSupplier(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingEdit}
                    className="bg-accent text-accent-foreground font-bold"
                  >
                    {isSavingEdit && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    {isSavingEdit ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 max-w-xl">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-accent/10 p-3 rounded-xl">
              <Building2 className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Vendors</p>
              <p className="text-2xl font-bold font-headline">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Added Today</p>
              <p className="text-2xl font-bold font-headline">{stats.newToday}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── VENDOR DIRECTORY TABLE (ALWAYS RENDERED - NEVER UNMOUNTS) ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent opacity-50" />
        </div>
      ) : (
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="font-headline text-xl">Vendor Directory</CardTitle>
              <CardDescription>All registered suppliers and their contact details.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers..."
                  className="pl-9 h-9 w-60 sm:w-72 bg-secondary/50 border-none rounded-full text-xs font-bold"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSuppliers}
                className="h-9 px-3 text-xs font-bold gap-1.5 rounded-full border-border/60 hover:bg-secondary/60 hover:text-accent shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <Table className="min-w-[650px]">
                <TableHeader className="bg-secondary/10">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 pl-6">Vendor Name</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Contact Person</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Communication</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Location</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-center w-16">Edit</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6 w-24">History</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id} className="border-border/50 hover:bg-secondary/10 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-accent/10 p-2 rounded-lg">
                            <Truck className="w-4 h-4 text-accent" />
                          </div>
                          <span className="font-bold text-accent">{s.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-xs">{s.contactPerson}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-code font-bold">
                            <Phone className="w-3 h-3 text-accent" /> {s.phone || "No phone"}
                          </div>
                          {s.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" /> {s.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 shrink-0" /> {s.address || "No address"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full hover:bg-accent/10 text-accent mx-auto"
                          onClick={() => {
                            setEditingSupplier(s)
                            setIsEditOpen(true)
                          }}
                          title="Edit Supplier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-bold rounded-lg border-accent/40 text-accent hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setSelectedDate("ALL")
                            setShowHistory(s.id)
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-3 opacity-40">
                          <Truck className="w-10 h-10" />
                          <p className="font-medium">No suppliers found.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SUPPLIER PURCHASE HISTORY SLIDE-OVER SHEET (NO FULL PAGE RELOAD) ── */}
      <Sheet open={!!showHistory} onOpenChange={(open) => {
        if (!open) {
          setShowHistory(false)
          setSelectedDate("ALL")
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl overflow-y-auto bg-card border-l border-border p-4 sm:p-6 space-y-4">
          <SheetHeader className="pb-3 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <SheetTitle className="font-headline text-xl text-foreground flex items-center gap-2">
                  <Truck className="w-5 h-5 text-accent" />
                  {selectedSupplier?.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  Contact: {selectedSupplier?.contactPerson || "N/A"} • 📞 {selectedSupplier?.phone || "N/A"}
                </SheetDescription>
              </div>

              {/* Action Buttons: Export & New Purchase */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSupplierHistory}
                  className="h-8 text-xs font-bold gap-1.5 rounded-xl border-accent/40 text-accent hover:bg-accent/10"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => router.push("/purchases/purchase-entry")}
                  className="h-8 text-xs font-bold bg-accent text-accent-foreground hover:brightness-110 rounded-xl"
                >
                  + New Purchase
                </Button>
              </div>
            </div>

            {/* ── DATE NAVIGATION STEPPER & ALL HISTORY BUTTON ── */}
            <div className="bg-secondary/20 border border-border/50 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 mt-3">
              
              {/* Stepper < Date > */}
              <div className="flex items-center bg-secondary/50 border border-border/50 rounded-lg p-0.5 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-secondary text-foreground hover:text-accent"
                  onClick={handlePrevDate}
                  disabled={uniqueDates.length === 0}
                  title="Previous Billing Date"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="px-2 text-center min-w-[110px]">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block leading-tight">
                    {selectedDate === "ALL" ? "All Dates" : "Billing Date"}
                  </span>
                  <span className="text-xs font-bold font-code text-accent">
                    {selectedDate === "ALL" ? "View All" : selectedDate}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-md hover:bg-secondary text-foreground hover:text-accent"
                  onClick={handleNextDate}
                  disabled={uniqueDates.length === 0 || selectedDate === "ALL"}
                  title="Next Billing Date"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* All Purchase History Button & Quick Badges */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedDate === "ALL" ? "default" : "outline"}
                  className="h-8 text-xs font-bold rounded-lg px-3 transition-all"
                  onClick={() => setSelectedDate("ALL")}
                >
                  All Purchase History ({purchaseHistory.length})
                </Button>
                {selectedDate !== "ALL" && (
                  <Badge variant="outline" className="text-[10px] font-code h-7 px-2 border-accent/40 text-accent">
                    {displayedPurchases.length} product(s) on {selectedDate}
                  </Badge>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Sheet Body: Summary Stats & Purchase History Table */}
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-xs text-muted-foreground font-medium">Loading vendor purchases...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-secondary/20 rounded-xl border border-border/40">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Filtered View</p>
                  <p className="text-sm font-bold text-foreground truncate mt-0.5">
                    {selectedDate === "ALL" ? "All Dates" : selectedDate}
                  </p>
                </div>
                <div className="p-3 bg-secondary/20 rounded-xl border border-border/40">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Quantity</p>
                  <p className="text-sm font-bold font-code text-foreground mt-0.5">
                    {historyTotalQty} units
                  </p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl border border-accent/25">
                  <p className="text-[10px] uppercase font-bold text-accent tracking-wider">Total Spent</p>
                  <p className="text-sm font-bold font-code text-accent mt-0.5">
                    ₹{historyTotalSpend.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Purchases Table */}
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[620px]">
                    <TableHeader className="bg-secondary/30">
                      <TableRow className="border-border/50 hover:bg-transparent">
                        <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 pl-4">Product Name</TableHead>
                        <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3">Billing Date</TableHead>
                        <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-center">Qty</TableHead>
                        <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right">Cost (₹)</TableHead>
                        <TableHead className="font-bold uppercase text-[10px] tracking-widest py-3 text-right pr-4">Total (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPurchases.map((p, idx) => {
                        const dateStr = p.billingDate || (p.createdAt ? p.createdAt.split("T")[0] : "N/A")
                        const qty = Number(p.quantity) || 1
                        const cost = Number(p.purchasePrice) || 0
                        const subtotal = qty * cost
                        return (
                          <TableRow key={p.id || idx} className="border-border/40 hover:bg-secondary/15 transition-colors">
                            <TableCell className="pl-4 py-3 font-medium text-xs text-foreground">
                              {p.productName}
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground font-code">
                              {dateStr}
                            </TableCell>
                            <TableCell className="py-3 text-center font-bold font-code text-xs">
                              {qty}
                            </TableCell>
                            <TableCell className="py-3 text-right font-code text-xs text-amber-400 font-bold">
                              ₹{cost.toLocaleString()}
                            </TableCell>
                            <TableCell className="py-3 text-right pr-4 font-bold font-code text-xs text-emerald-400">
                              ₹{subtotal.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}

                      {displayedPurchases.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                            <div className="flex flex-col items-center gap-2 opacity-50">
                              <Package className="w-8 h-8" />
                              <p className="text-xs font-semibold">No purchase history found for this selection.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── EXPORT FORMAT SELECTOR MODAL (PDF / EXCEL / GOOGLE SHEETS) ── */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Download className="w-5 h-5 text-accent" /> Export Data
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Choose the format to export <span className="font-semibold text-foreground">{exportData?.title}</span>:
            </p>
          </DialogHeader>

          {exportData && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-4">
              {/* PDF Document */}
              <button
                type="button"
                onClick={() => {
                  exportToPDF(
                    exportData.title,
                    exportData.subtitle,
                    exportData.headers,
                    exportData.rows,
                    exportData.summary
                  )
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-foreground">PDF Document</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Print / Save .pdf</span>
              </button>

              {/* Microsoft Excel */}
              <button
                type="button"
                onClick={() => {
                  exportToCSV(exportData.filename, exportData.headers, exportData.rows)
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-foreground">Excel Spreadsheet</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Microsoft Excel .csv</span>
              </button>

              {/* Google Sheets */}
              <button
                type="button"
                onClick={() => {
                  exportToGoogleSheets(exportData.filename, exportData.headers, exportData.rows)
                  setIsExportOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-border/60 bg-secondary/20 hover:bg-blue-500/10 hover:border-blue-500/50 transition-all text-center group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <ExternalLink className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-foreground">Google Sheets</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Open &amp; Import</span>
              </button>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setIsExportOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
