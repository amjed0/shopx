"use client"

import * as React from "react"
import {
  BookOpen,
  Plus,
  Trash2,
  Loader2,
  Save,
  CheckCircle2,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Tag,
  FileText,
  CreditCard,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  StickyNote,
  History,
  Truck,
  Building2,
  ArrowDownLeft,
  User,
  Receipt,
  Calendar,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUser } from "@/app/auth/use-user"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  "Sales", "Customer Credit Collection", "Service Revenue", "Refund Received", "Investment",
  "Loan Received", "Commission", "Rental Income", "Other Income",
]

const EXPENSE_CATEGORIES = [
  "Supplier Payment", "Purchase / Stock", "Rent", "Electricity", "Salaries", "Transport", "Maintenance",
  "Marketing", "Miscellaneous", "Office Supplies", "Food & Beverage",
  "Internet & Phone",
]

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque"]

type EntryType = "income" | "expense"
type PeriodFilter = "today" | "monthly" | "yearly" | "all"

interface CashbookItem {
  id: string
  type: EntryType
  category: string
  description: string
  amount: number
  paymentMode: string
  note: string
}

interface CashbookHistoryEntry {
  id: string
  type: "income" | "expense"
  category: string
  description: string
  amount: number
  paymentMode: string
  note?: string
  createdAt: string
}

const emptyItem = (type: EntryType = "income"): CashbookItem => ({
  id: Math.random().toString(36).slice(2),
  type,
  category: "",
  description: "",
  amount: 0,
  paymentMode: "Cash",
  note: "",
})

const fmt = (n: number) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const formatDate = (s: string) => {
  if (!s) return "—"
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const formatDateTime = (s: string) => {
  if (!s) return "—"
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Helper to filter dates by period
const isDateInPeriod = (dateStr: string, period: PeriodFilter): boolean => {
  if (!dateStr || period === "all") return true
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false

  const now = new Date()
  if (period === "today") {
    return d.toDateString() === now.toDateString()
  }
  if (period === "monthly") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  if (period === "yearly") {
    return d.getFullYear() === now.getFullYear()
  }
  return true
}

// ─── Mobile Card Component ────────────────────────────────────────────────────

function MobileEntryCard({
  item,
  index,
  onUpdate,
  onRemove,
  customCategory,
  setCustomCategory,
  disabled,
}: {
  item: CashbookItem
  index: number
  onUpdate: (id: string, field: keyof CashbookItem, value: unknown) => void
  onRemove: (id: string) => void
  customCategory: Record<string, boolean>
  setCustomCategory: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  disabled: boolean
}) {
  const isIncome = item.type === "income"
  const cats = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className={`p-4 border-b border-border/40 space-y-3 ${isIncome ? "bg-green-500/5" : "bg-destructive/5"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold font-code text-muted-foreground">#{index + 1}</span>
        <div className="flex items-center gap-2">
          {/* Type Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border/50 text-xs font-bold">
            <button
              type="button"
              className={`px-2.5 py-1 transition-colors ${isIncome ? "bg-green-500 text-white" : "bg-secondary text-muted-foreground"}`}
              onClick={() => onUpdate(item.id, "type", "income")}
            >
              Income
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 transition-colors ${!isIncome ? "bg-destructive text-white" : "bg-secondary text-muted-foreground"}`}
              onClick={() => onUpdate(item.id, "type", "expense")}
            >
              Expense
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive/40 hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Category */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Category</Label>
          {customCategory[item.id] ? (
            <div className="flex gap-1">
              <Input
                autoFocus
                placeholder="Category..."
                className="h-8 text-xs bg-secondary/20 border-none"
                value={item.category}
                onChange={e => onUpdate(item.id, "category", e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground shrink-0"
                onClick={() => setCustomCategory(p => ({ ...p, [item.id]: false }))}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Select
              value={item.category}
              onValueChange={val => {
                if (val === "__custom__") {
                  setCustomCategory(p => ({ ...p, [item.id]: true }))
                  onUpdate(item.id, "category", "")
                } else {
                  onUpdate(item.id, "category", val)
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-secondary/20 border-none">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {cats.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
                <SelectItem value="__custom__">+ Custom</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Amount */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Amount (₹)</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">₹</span>
            <Input
              type="number"
              placeholder="0"
              className="h-8 text-xs bg-secondary/20 border-none font-bold pl-6"
              value={item.amount || ""}
              onChange={e => onUpdate(item.id, "amount", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground uppercase font-bold">Description</Label>
        <Input
          placeholder="What was this for?"
          className="h-8 text-xs bg-secondary/20 border-none"
          value={item.description}
          onChange={e => onUpdate(item.id, "description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Payment Mode */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Payment Mode</Label>
          <Select
            value={item.paymentMode}
            onValueChange={val => onUpdate(item.id, "paymentMode", val)}
          >
            <SelectTrigger className="h-8 text-xs bg-secondary/20 border-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_MODES.map(m => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Note */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground uppercase font-bold">Note (Optional)</Label>
          <Input
            placeholder="Optional..."
            className="h-8 text-xs bg-secondary/20 border-none"
            value={item.note}
            onChange={e => onUpdate(item.id, "note", e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CashbookPage() {
  const { user } = useUser()
  const router = useRouter()

  // New batch entry items currently being typed
  const [items, setItems] = React.useState<CashbookItem[]>([emptyItem("income")])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [customCategory, setCustomCategory] = React.useState<Record<string, boolean>>({})

  // Past Saved Cashbook History State
  const [pastEntries, setPastEntries] = React.useState<CashbookHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [selectedPeriod, setSelectedPeriod] = React.useState<PeriodFilter>("today")
  const [historyTypeFilter, setHistoryTypeFilter] = React.useState<"all" | "income" | "expense">("all")
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(true)
  const [historySearchQuery, setHistorySearchQuery] = React.useState("")
  const historySectionRef = React.useRef<HTMLDivElement>(null)

  // Supplier Payment State
  const [suppliers, setSuppliers] = React.useState<{ id: string; name: string; phone?: string }[]>([])
  const [supplierPurchases, setSupplierPurchases] = React.useState<any[]>([])
  const [allSupplierPayments, setAllSupplierPayments] = React.useState<any[]>([])
  const [supplierPayOpen, setSupplierPayOpen] = React.useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = React.useState("")
  const [supplierBalance, setSupplierBalance] = React.useState<{ totalPurchased: number; totalPaid: number; balance: number } | null>(null)
  const [loadingSupplierBalance, setLoadingSupplierBalance] = React.useState(false)
  const [payAmount, setPayAmount] = React.useState("")
  const [payMode, setPayMode] = React.useState("Cash")
  const [payNote, setPayNote] = React.useState("")
  const [isSubmittingPay, setIsSubmittingPay] = React.useState(false)

  // Customer Collection State
  const [customers, setCustomers] = React.useState<any[]>([])
  const [sales, setSales] = React.useState<any[]>([])
  const [customerCollectOpen, setCustomerCollectOpen] = React.useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("")
  const [collectAmount, setCollectAmount] = React.useState("")
  const [collectMode, setCollectMode] = React.useState("Cash")
  const [collectNote, setCollectNote] = React.useState("")
  const [isSubmittingCollect, setIsSubmittingCollect] = React.useState(false)

  // Fetch past saved cashbook history records
  const fetchCashbookHistory = React.useCallback(async () => {
    if (!user?.uid) return
    setLoadingHistory(true)
    try {
      const res = await fetch("/api/cashbook", { headers: { "x-user-id": user.uid } })
      if (res.ok) {
        const data = await res.json()
        setPastEntries(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingHistory(false)
    }
  }, [user?.uid])

  // Fetch all suppliers, purchases, supplier payments, customers and sales
  const fetchAccountingData = React.useCallback(async () => {
    if (!user?.uid) return
    try {
      const [supRes, purRes, payRes, custRes, salesRes] = await Promise.all([
        fetch("/api/suppliers", { headers: { "x-user-id": user.uid } }),
        fetch("/api/purchases", { headers: { "x-user-id": user.uid } }),
        fetch("/api/supplier-payments", { headers: { "x-user-id": user.uid } }),
        fetch("/api/customers", { headers: { "x-user-id": user.uid } }),
        fetch("/api/sales", { headers: { "x-user-id": user.uid } }),
      ])
      if (supRes.ok) setSuppliers(await supRes.json())
      if (purRes.ok) setSupplierPurchases(await purRes.json())
      if (payRes.ok) {
        const p = await payRes.json()
        setAllSupplierPayments(Array.isArray(p) ? p : p.payments || [])
      }
      if (custRes.ok) setCustomers(await custRes.json())
      if (salesRes.ok) setSales(await salesRes.json())
    } catch (err) {
      console.error(err)
    }
  }, [user?.uid])

  React.useEffect(() => {
    fetchCashbookHistory()
    fetchAccountingData()
  }, [fetchCashbookHistory, fetchAccountingData])

  // ── COMPUTED PAST SAVED DATA FOR SELECTED PERIOD (TODAY / MONTHLY / YEARLY) ──
  const periodEntries = React.useMemo(() => {
    return pastEntries.filter(e => isDateInPeriod(e.createdAt, selectedPeriod))
  }, [pastEntries, selectedPeriod])

  const periodIncome = React.useMemo(() => {
    return periodEntries
      .filter(e => e.type === "income")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  }, [periodEntries])

  const periodExpense = React.useMemo(() => {
    return periodEntries
      .filter(e => e.type === "expense")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  }, [periodEntries])

  const periodBalance = periodIncome - periodExpense

  // Displayed entries in the Past History Table
  const displayedHistoryEntries = React.useMemo(() => {
    return periodEntries.filter(e => {
      const matchesType =
        historyTypeFilter === "all" ? true : e.type === historyTypeFilter

      const q = historySearchQuery.toLowerCase()
      const matchesSearch =
        !q ||
        (e.category && e.category.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.note && e.note.toLowerCase().includes(q)) ||
        (e.paymentMode && e.paymentMode.toLowerCase().includes(q))

      return matchesType && matchesSearch
    })
  }, [periodEntries, historyTypeFilter, historySearchQuery])

  // Delete an individual past record
  const handleDeleteHistoryEntry = async (id: string, type: "income" | "expense") => {
    if (!user?.uid) return
    try {
      const res = await fetch(`/api/cashbook?id=${id}&type=${type}`, {
        method: "DELETE",
        headers: { "x-user-id": user.uid },
      })
      if (!res.ok) throw new Error("Failed to delete cashbook entry")
      toast({ title: "Entry Deleted", description: "Record removed from cashbook." })
      setPastEntries(prev => prev.filter(e => e.id !== id))
    } catch (err: any) {
      toast({ variant: "destructive", title: "Delete Failed", description: err.message })
    }
  }

  // ── SUPPLIER & CUSTOMER HELPERS ──
  const suppliersWithBalance = React.useMemo(() => {
    return suppliers.map(sup => {
      const supPurchases = supplierPurchases.filter((p: any) => p.supplierId === sup.id)
      const supPayments = allSupplierPayments.filter((p: any) => p.supplierId === sup.id)
      const totalPurchased = supPurchases.reduce(
        (acc: number, p: any) => acc + ((Number(p.quantity) || 1) * (Number(p.purchasePrice) || 0)),
        0
      )
      const totalPaid = supPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0)
      const balance = Math.max(0, totalPurchased - totalPaid)
      return {
        ...sup,
        totalPurchased,
        totalPaid,
        balance,
      }
    })
  }, [suppliers, supplierPurchases, allSupplierPayments])

  const suppliersWithDuesOnly = React.useMemo(() => {
    return suppliersWithBalance.filter(s => s.balance > 0)
  }, [suppliersWithBalance])

  React.useEffect(() => {
    if (!selectedSupplierId || !user?.uid) {
      setSupplierBalance(null)
      return
    }
    const sup = suppliersWithBalance.find(s => s.id === selectedSupplierId)
    if (sup) {
      setSupplierBalance({
        totalPurchased: sup.totalPurchased,
        totalPaid: sup.totalPaid,
        balance: sup.balance,
      })
      if (sup.balance > 0) {
        setPayAmount(String(sup.balance))
      }
    }
  }, [selectedSupplierId, suppliersWithBalance, user?.uid])

  const creditCustomersOnly = React.useMemo(() => {
    return customers.filter((c: any) => (Number(c.outstandingBalance) || 0) > 0)
  }, [customers])

  const selectedCustomer = React.useMemo(() => {
    return customers.find((c: any) => c.id === selectedCustomerId)
  }, [customers, selectedCustomerId])

  const customerCreditBills = React.useMemo(() => {
    if (!selectedCustomerId) return []
    return sales
      .filter((s: any) => s.customerId === selectedCustomerId)
      .sort((a: any, b: any) => new Date(b.date || b.createdAt || "").getTime() - new Date(a.date || a.createdAt || "").getTime())
  }, [sales, selectedCustomerId])

  const customerTotalBilled = React.useMemo(() => {
    return customerCreditBills.reduce((acc: number, s: any) => acc + (Number(s.total) || 0), 0)
  }, [customerCreditBills])

  const customerAlreadyPaid = React.useMemo(() => {
    if (!selectedCustomer) return 0
    const outstanding = Number(selectedCustomer.outstandingBalance) || 0
    return Math.max(0, customerTotalBilled - outstanding)
  }, [selectedCustomer, customerTotalBilled])

  React.useEffect(() => {
    if (!selectedCustomerId) {
      setCollectAmount("")
      return
    }
    const cust = customers.find((c: any) => c.id === selectedCustomerId)
    if (cust && Number(cust.outstandingBalance) > 0) {
      setCollectAmount(String(cust.outstandingBalance))
    }
  }, [selectedCustomerId, customers])

  // ── RECORD SUPPLIER PAYMENT ──
  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid || !selectedSupplierId || !Number(payAmount)) return
    setIsSubmittingPay(true)
    try {
      const sup = suppliers.find(s => s.id === selectedSupplierId)
      const supName = sup?.name || "Supplier"

      const payRes = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          amount: Number(payAmount),
          paymentMode: payMode,
          note: payNote,
        }),
      })
      if (!payRes.ok) throw new Error("Failed to record supplier payment")
      const payData = await payRes.json()

      await fetch("/api/cashbook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify({
          type: "expense",
          category: "Supplier Payment",
          description: `Payment to ${supName}`,
          amount: Number(payAmount),
          paymentMode: payMode,
          note: payNote || `Remaining Balance: ₹${(payData.balance || 0).toLocaleString()}`,
        }),
      })

      toast({
        title: "Supplier Payment Recorded ✓",
        description: `Paid ₹${Number(payAmount).toLocaleString()} to ${supName}. New Balance: ₹${(payData.balance || 0).toLocaleString()}`,
      })

      fetchAccountingData()
      fetchCashbookHistory()
      setSupplierPayOpen(false)
      setSelectedSupplierId("")
      setPayAmount("")
      setPayNote("")
      setSupplierBalance(null)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: err.message,
      })
    } finally {
      setIsSubmittingPay(false)
    }
  }

  // ── RECORD CUSTOMER COLLECTION ──
  const handleRecordCustomerCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid || !selectedCustomerId || !Number(collectAmount)) return
    setIsSubmittingCollect(true)
    try {
      const cust = customers.find((c: any) => c.id === selectedCustomerId)
      const custName = cust?.name || "Customer"
      const amount = Number(collectAmount)
      const currentBal = Number(cust?.outstandingBalance) || 0

      if (amount > currentBal) {
        toast({
          variant: "destructive",
          title: "Excess Payment",
          description: `Collection amount cannot exceed outstanding balance of ₹${currentBal.toLocaleString()}.`,
        })
        setIsSubmittingCollect(false)
        return
      }

      const newBalance = Math.max(0, currentBal - amount)

      const custRes = await fetch(`/api/customers/${selectedCustomerId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify({ outstandingBalance: newBalance }),
      })
      if (!custRes.ok) throw new Error("Failed to update customer balance")

      if (newBalance === 0) {
        const pendingSales = sales.filter((s: any) => s.customerId === selectedCustomerId && s.status === "pending")
        for (const sale of pendingSales) {
          await fetch(`/api/sales/${sale.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            body: JSON.stringify({ status: "paid" }),
          }).catch(console.error)
        }
      }

      await fetch("/api/cashbook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": user.uid },
        body: JSON.stringify({
          type: "income",
          category: "Customer Credit Collection",
          description: `Credit collection from ${custName}`,
          amount: amount,
          paymentMode: collectMode,
          note: collectNote || `Remaining Balance: ₹${newBalance.toLocaleString()}`,
        }),
      })

      toast({
        title: "Customer Collection Recorded ✓",
        description: `Collected ₹${amount.toLocaleString()} from ${custName} (${collectMode}). Remaining Due: ₹${newBalance.toLocaleString()}`,
      })

      fetchAccountingData()
      fetchCashbookHistory()
      setCustomerCollectOpen(false)
      setSelectedCustomerId("")
      setCollectAmount("")
      setCollectNote("")
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Collection Failed",
        description: err.message,
      })
    } finally {
      setIsSubmittingCollect(false)
    }
  }

  // ── CURRENT FORM BATCH TOTALS ──
  const totalIncome = items.filter(i => i.type === "income").reduce((acc, i) => acc + (Number(i.amount) || 0), 0)
  const totalExpense = items.filter(i => i.type === "expense").reduce((acc, i) => acc + (Number(i.amount) || 0), 0)
  const balance = totalIncome - totalExpense
  const isValid = items.every(i => i.category && i.description && Number(i.amount) > 0)

  const addRow = (type: EntryType) => setItems(prev => [...prev, emptyItem(type)])

  const removeRow = (id: string) =>
    setItems(prev => (prev.length === 1 ? prev : prev.filter(i => i.id !== id)))

  const updateItem = (id: string, field: keyof CashbookItem, value: unknown) =>
    setItems(prev =>
      prev.map(i => {
        if (i.id !== id) return i
        if (field === "type") return { ...i, type: value as EntryType, category: "" }
        return { ...i, [field]: value }
      })
    )

  // ── SAVE CASHBOOK ENTRIES & CLEAR FORM ──
  const handleSubmit = async () => {
    if (!user?.uid || !isValid) {
      toast({
        variant: "destructive",
        title: "Incomplete Entries",
        description: "Please fill category, description, and amount for all rows.",
      })
      return
    }
    setIsSubmitting(true)
    try {
      await Promise.all(
        items.map(item =>
          fetch("/api/cashbook", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": user.uid },
            credentials: "include",
            body: JSON.stringify({
              type: item.type,
              category: item.category,
              description: item.description,
              amount: Number(item.amount),
              paymentMode: item.paymentMode,
              note: item.note,
            }),
          }).then(res => {
            if (!res.ok) throw new Error("Failed to save entry")
          })
        )
      )
      toast({
        title: "Cashbook Saved ✓",
        description: `Successfully saved ${items.length} entr${items.length > 1 ? "ies" : "y"}. The sheet is now cleared!`,
      })

      // Completely clear the sheet after saving
      setItems([emptyItem("income")])
      setCustomCategory({})

      // Refresh past entries and accounting data
      fetchCashbookHistory()
      fetchAccountingData()
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const periodDisplayLabel = {
    today: "Today",
    monthly: "This Month",
    yearly: "This Year",
    all: "All Time",
  }[selectedPeriod]

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-bold">
            Cash <span className="text-accent">Book</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Record daily cashflows, collect customer balances, and clear supplier payables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-8 sm:h-9 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            onClick={() => setCustomerCollectOpen(true)}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 mr-1.5" /> Collect Due
          </Button>
          <Button
            variant="outline"
            className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-8 sm:h-9 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            onClick={() => setSupplierPayOpen(true)}
          >
            <Truck className="w-3.5 h-3.5 mr-1.5" /> Pay Supplier
          </Button>
          <Button
            variant="outline"
            className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-8 sm:h-9"
            onClick={() => router.push("/accounting/cashbook/history")}
          >
            <History className="w-3.5 h-3.5 mr-1.5" /> Full History
          </Button>
        </div>
      </div>

      {/* ── PERIOD SELECTOR & INTERACTIVE STATS BOXES (WORK LIKE BUTTONS) ── */}
      <div className="space-y-3">
        {/* Period Selector Tabs: Today / Monthly / Yearly / All Time */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cashflow Statistics Period:
            </span>
            <Badge variant="outline" className="text-[10px] font-bold font-mono">
              {periodDisplayLabel}
            </Badge>
          </div>

          <div className="inline-flex rounded-xl bg-secondary/50 p-1 text-xs font-semibold border border-border/50 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedPeriod("today")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all",
                selectedPeriod === "today"
                  ? "bg-card shadow-sm text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("monthly")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all",
                selectedPeriod === "monthly"
                  ? "bg-card shadow-sm text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("yearly")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all",
                selectedPeriod === "yearly"
                  ? "bg-card shadow-sm text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("all")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all",
                selectedPeriod === "all"
                  ? "bg-card shadow-sm text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Time
            </button>
          </div>
        </div>

        {/* 3 Clickable Summary Cards (Income Box, Expense Box, Net Balance Box) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {/* INCOME BOX (Clickable Button) */}
          <button
            type="button"
            onClick={() => {
              setHistoryTypeFilter("income")
              setIsHistoryOpen(true)
              setTimeout(() => {
                historySectionRef.current?.scrollIntoView({ behavior: "smooth" })
              }, 50)
            }}
            className={cn(
              "text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group shadow-sm",
              historyTypeFilter === "income" && isHistoryOpen
                ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                : "bg-card border-border/60 hover:border-emerald-500/50 hover:bg-emerald-500/5"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
                  <ArrowDownCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {periodDisplayLabel} Income
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono text-emerald-500 mt-0.5">
                    {fmt(periodIncome)}
                  </h3>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 uppercase"
              >
                Touch to View
              </Badge>
            </div>
          </button>

          {/* EXPENSE BOX (Clickable Button) */}
          <button
            type="button"
            onClick={() => {
              setHistoryTypeFilter("expense")
              setIsHistoryOpen(true)
              setTimeout(() => {
                historySectionRef.current?.scrollIntoView({ behavior: "smooth" })
              }, 50)
            }}
            className={cn(
              "text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group shadow-sm",
              historyTypeFilter === "expense" && isHistoryOpen
                ? "bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/20 shadow-md"
                : "bg-card border-border/60 hover:border-rose-500/50 hover:bg-rose-500/5"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                  <ArrowUpCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {periodDisplayLabel} Expense
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold font-mono text-rose-500 mt-0.5">
                    {fmt(periodExpense)}
                  </h3>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] font-bold text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10 uppercase"
              >
                Touch to View
              </Badge>
            </div>
          </button>

          {/* NET BALANCE BOX (Clickable Button) */}
          <button
            type="button"
            onClick={() => {
              setHistoryTypeFilter("all")
              setIsHistoryOpen(true)
              setTimeout(() => {
                historySectionRef.current?.scrollIntoView({ behavior: "smooth" })
              }, 50)
            }}
            className={cn(
              "text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group shadow-sm",
              historyTypeFilter === "all" && isHistoryOpen
                ? "bg-primary/10 border-primary ring-2 ring-primary/20 shadow-md"
                : "bg-card border-border/60 hover:border-primary/50 hover:bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2.5 rounded-xl group-hover:scale-110 transition-transform",
                    periodBalance >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}
                >
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {periodDisplayLabel} Net Balance
                  </p>
                  <h3
                    className={cn(
                      "text-xl sm:text-2xl font-bold font-mono mt-0.5",
                      periodBalance >= 0 ? "text-primary" : "text-rose-500"
                    )}
                  >
                    {fmt(periodBalance)}
                  </h3>
                </div>
              </div>
              <Badge variant="outline" className="text-[9px] font-bold uppercase">
                All History
              </Badge>
            </div>
          </button>
        </div>
      </div>

      {/* ── PAST SAVED HISTORY TABLE (TOUCHING INCOME/EXPENSE BOX SHOWS FULL PAST DATA TABLE) ── */}
      {isHistoryOpen && (
        <div ref={historySectionRef} className="space-y-3 pt-1 animate-in fade-in duration-300">
          <Card className="border-none bg-card shadow-sm overflow-hidden">
            <CardHeader className="bg-secondary/20 border-b border-border/50 py-3.5 px-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {historyTypeFilter === "income" ? (
                    <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
                  ) : historyTypeFilter === "expense" ? (
                    <ArrowUpCircle className="w-5 h-5 text-rose-500" />
                  ) : (
                    <History className="w-5 h-5 text-primary" />
                  )}
                  <CardTitle className="text-base sm:text-lg font-bold">
                    {historyTypeFilter === "income"
                      ? `Past Saved Income History (${periodDisplayLabel})`
                      : historyTypeFilter === "expense"
                      ? `Past Saved Expense History (${periodDisplayLabel})`
                      : `All Past Saved Transactions (${periodDisplayLabel})`}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-mono font-bold">
                    {displayedHistoryEntries.length} record(s)
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Filtered by <strong>{periodDisplayLabel}</strong> • Click any card above to toggle Income, Expense, or All.
                </CardDescription>
              </div>

              {/* Search + Filter switcher + Close button */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg bg-secondary/50 p-0.5 text-xs font-semibold border border-border/40">
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("all")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] transition-all",
                      historyTypeFilter === "all" ? "bg-card shadow-sm text-foreground font-bold" : "text-muted-foreground"
                    )}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("income")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] transition-all",
                      historyTypeFilter === "income" ? "bg-card shadow-sm text-emerald-500 font-bold" : "text-muted-foreground"
                    )}
                  >
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("expense")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] transition-all",
                      historyTypeFilter === "expense" ? "bg-card shadow-sm text-rose-500 font-bold" : "text-muted-foreground"
                    )}
                  >
                    Expense
                  </button>
                </div>

                <div className="relative w-40 sm:w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search past records..."
                    value={historySearchQuery}
                    onChange={e => setHistorySearchQuery(e.target.value)}
                    className="pl-8 bg-secondary/30 border-none rounded-xl text-xs h-8"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsHistoryOpen(false)}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronUp className="w-4 h-4 mr-1" /> Hide Table
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingHistory ? (
                <div className="flex justify-center items-center py-16 gap-2 text-muted-foreground text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span>Loading past cashbook entries...</span>
                </div>
              ) : displayedHistoryEntries.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-xs space-y-1">
                  <FileText className="w-8 h-8 mx-auto opacity-30 mb-2" />
                  <p className="font-semibold">
                    No {historyTypeFilter !== "all" ? historyTypeFilter : ""} entries found for {periodDisplayLabel}.
                  </p>
                  <p className="text-[11px] opacity-75">
                    Entries saved in the cashbook sheet will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto w-full max-h-[420px]">
                  <Table className="min-w-[700px] w-full">
                    <TableHeader className="bg-secondary/20 sticky top-0 z-10 backdrop-blur-sm">
                      <TableRow className="border-border/40 hover:bg-transparent">
                        <TableHead className="w-10 text-center text-[10px] font-bold uppercase py-2.5 pl-4">#</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-2.5">Date &amp; Time</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-2.5">Type</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-2.5">Category</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-2.5">Description</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-2.5">Payment Mode</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase py-2.5">Note</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase py-2.5">Amount (₹)</TableHead>
                        <TableHead className="w-10 text-center py-2.5 pr-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedHistoryEntries.map((e, idx) => {
                        const isInc = e.type === "income"
                        return (
                          <TableRow key={e.id} className="border-border/30 hover:bg-secondary/10 transition-colors">
                            <TableCell className="text-center font-mono text-xs text-muted-foreground pl-4">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                              {formatDateTime(e.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] font-bold uppercase",
                                  isInc
                                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                                    : "border-rose-500/30 text-rose-500 bg-rose-500/5"
                                )}
                              >
                                {isInc ? "Income" : "Expense"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-foreground whitespace-nowrap">
                              {e.category}
                            </TableCell>
                            <TableCell className="text-xs text-foreground max-w-xs truncate">
                              {e.description}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] bg-secondary/30">
                                {e.paymentMode || "Cash"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                              {e.note || "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs whitespace-nowrap">
                              <span className={isInc ? "text-emerald-500" : "text-rose-500"}>
                                {isInc ? "+" : "-"}&nbsp;₹{Number(e.amount).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-center pr-4">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteHistoryEntry(e.id, e.type)}
                                title="Delete Entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CASHBOOK ENTRY SHEET (REDESIGNED RECORDER WITH CLEAR & SAVE BUTTON) ── */}
      <Card className="border-none bg-card shadow-xl overflow-hidden rounded-2xl">
        <CardHeader className="bg-secondary/20 border-b border-border/50 py-3.5 px-4 sm:px-6 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-accent/15 text-accent shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-lg font-bold">New Cashbook Sheet Entry</CardTitle>
              
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => addRow("income")}
              variant="outline"
              size="sm"
              className="rounded-xl text-[10px] font-bold uppercase tracking-wider border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 h-8 px-3"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 mr-1" />
              <span>+ Income Row</span>
            </Button>
            <Button
              onClick={() => addRow("expense")}
              variant="outline"
              size="sm"
              className="rounded-xl text-[10px] font-bold uppercase tracking-wider border-destructive/30 text-destructive hover:bg-destructive/10 h-8 px-3"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />
              <span>+ Expense Row</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Mobile view */}
          <div className="block md:hidden">
            {items.map((item, index) => (
              <MobileEntryCard
                key={item.id}
                item={item}
                index={index}
                onUpdate={updateItem}
                onRemove={removeRow}
                customCategory={customCategory}
                setCustomCategory={setCustomCategory}
                disabled={items.length === 1}
              />
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-border/50">
                  <TableHead className="w-10 text-center text-[10px] font-bold uppercase py-3 pl-4">#</TableHead>
                  <TableHead className="w-[130px] text-[10px] font-bold uppercase py-3">
                    <span className="flex items-center gap-1">
                      <ArrowDownCircle className="w-3 h-3" /> Type
                    </span>
                  </TableHead>
                  <TableHead className="w-[170px] text-[10px] font-bold uppercase py-3">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" /> Category
                    </span>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase py-3">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Description
                    </span>
                  </TableHead>
                  <TableHead className="w-[140px] text-[10px] font-bold uppercase py-3">
                    <span className="flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" /> Amount
                    </span>
                  </TableHead>
                  <TableHead className="w-[150px] text-[10px] font-bold uppercase py-3">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> Payment Mode
                    </span>
                  </TableHead>
                  <TableHead className="text-[10px] font-bold uppercase py-3">
                    <span className="flex items-center gap-1">
                      <StickyNote className="w-3 h-3" /> Note
                    </span>
                  </TableHead>
                  <TableHead className="w-10 py-3 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const isIncome = item.type === "income"
                  const cats = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
                  return (
                    <TableRow key={item.id} className="border-border/30 group hover:bg-secondary/5">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground pl-4">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.type}
                          onValueChange={val => updateItem(item.id, "type", val as EntryType)}
                        >
                          <SelectTrigger
                            className={`h-8 text-xs border-none font-bold ${
                              isIncome ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">
                              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                <ArrowDownCircle className="w-3 h-3" /> Income
                              </span>
                            </SelectItem>
                            <SelectItem value="expense">
                              <span className="flex items-center gap-1.5 text-destructive">
                                <ArrowUpCircle className="w-3 h-3" /> Expense
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {customCategory[item.id] ? (
                          <div className="flex gap-1">
                            <Input
                              autoFocus
                              placeholder="Category..."
                              className="h-8 text-xs bg-secondary/20 border-none"
                              value={item.category}
                              onChange={e => updateItem(item.id, "category", e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => setCustomCategory(p => ({ ...p, [item.id]: false }))}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={item.category}
                            onValueChange={val => {
                              if (val === "__custom__") {
                                setCustomCategory(p => ({ ...p, [item.id]: true }))
                                updateItem(item.id, "category", "")
                              } else updateItem(item.id, "category", val)
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-secondary/20 border-none">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {cats.map(c => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                              <SelectItem value="__custom__">+ Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="What was this for?"
                          className="h-8 text-xs bg-secondary/20 border-none"
                          value={item.description}
                          onChange={e => updateItem(item.id, "description", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">
                            ₹
                          </span>
                          <Input
                            type="number"
                            className="h-8 text-xs bg-secondary/20 border-none font-bold pl-6"
                            value={item.amount || ""}
                            onChange={e => updateItem(item.id, "amount", e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.paymentMode}
                          onValueChange={val => updateItem(item.id, "paymentMode", val)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-secondary/20 border-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_MODES.map(m => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Optional note..."
                          className="h-8 text-xs bg-secondary/20 border-none"
                          value={item.note}
                          onChange={e => updateItem(item.id, "note", e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="pr-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive/30 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeRow(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>

        {/* ── SHEET FOOTER WITH LIVE ROW TOTALS & SAVE ALL BUTTON ── */}
        <CardContent className="bg-secondary/15 border-t border-border/50 py-3.5 px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center gap-3 text-xs font-semibold">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setItems([emptyItem("income")])
                  setCustomCategory({})
                }}
                disabled={items.length === 1 && !items[0].category && !items[0].description}
                className="text-xs h-8 text-muted-foreground hover:text-destructive gap-1 rounded-xl"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Sheet</span>
              </Button>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-emerald-500 font-bold">IN: {fmt(totalIncome)}</span>
                <span className="text-rose-500 font-bold">OUT: {fmt(totalExpense)}</span>
                <span className={cn("font-bold", balance >= 0 ? "text-primary" : "text-rose-500")}>
                  NET: {fmt(balance)}
                </span>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 rounded-xl shadow-md h-9 text-xs sm:text-sm gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Entries...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save All Entries &amp; Clear</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── PAY SUPPLIER DIALOG ── */}
      <Dialog open={supplierPayOpen} onOpenChange={setSupplierPayOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <form onSubmit={handleRecordSupplierPayment}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Truck className="w-5 h-5 text-accent" /> Pay Supplier / Clear Due Balance
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Select a supplier to inspect their total purchases and outstanding credit balance, then record a payment.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Supplier selector (Only suppliers with balance dues) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Select Supplier</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {suppliersWithDuesOnly.length} supplier(s) with balance dues
                  </span>
                </div>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Choose a supplier with balance..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliersWithDuesOnly.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        ✓ All supplier accounts are cleared (No pending dues)
                      </SelectItem>
                    ) : (
                      suppliersWithDuesOnly.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} {s.phone ? `(${s.phone})` : ""} — Due: ₹{s.balance.toLocaleString()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Balance Summary Card */}
              {loadingSupplierBalance && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                </div>
              )}

              {supplierBalance && !loadingSupplierBalance && (
                <div className="rounded-xl p-3.5 bg-secondary/30 border border-border/50 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-background">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Total Bills</p>
                      <p className="text-xs font-bold font-code mt-0.5">₹{supplierBalance.totalPurchased.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Already Paid</p>
                      <p className="text-xs font-bold font-code text-green-600 mt-0.5">₹{supplierBalance.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-amber-500/20">
                      <p className="text-[9px] uppercase font-bold text-amber-500">Balance Due</p>
                      <p className="text-xs font-bold font-code text-amber-500 mt-0.5">₹{supplierBalance.balance.toLocaleString()}</p>
                    </div>
                  </div>
                  {supplierBalance.balance <= 0 && (
                    <p className="text-[10px] text-center text-green-600 font-bold">
                      ✓ All bills for this supplier are fully cleared!
                    </p>
                  )}
                </div>
              )}

              {/* Amount to pay */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Amount (₹) *</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-10 text-xs font-bold font-code rounded-xl"
                    placeholder="e.g. 5000"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Mode</Label>
                  <Select value={payMode} onValueChange={setPayMode}>
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Note / Remarks (Optional)</Label>
                <Input
                  className="h-10 text-xs rounded-xl"
                  placeholder="e.g. Cleared bill INV-102 via UPI"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs rounded-xl"
                onClick={() => setSupplierPayOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingPay || !selectedSupplierId || !Number(payAmount)}
                className="bg-accent text-accent-foreground text-xs font-bold rounded-xl shadow-md"
              >
                {isSubmittingPay && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Record Payment &amp; Reduce Balance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── COLLECT CUSTOMER DUE DIALOG ── */}
      <Dialog open={customerCollectOpen} onOpenChange={setCustomerCollectOpen}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl">
          <form onSubmit={handleRecordCustomerCollection}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-500" /> Collect Customer Due / Payment
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Select a customer with an outstanding balance, view their credit bills, and record a collection payment.
              </p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Customer selector (Filters to only customers with dues) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Select Customer</Label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {creditCustomersOnly.length} customer(s) with dues
                  </span>
                </div>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="h-10 text-xs rounded-xl">
                    <SelectValue placeholder="Choose a customer with balance due..." />
                  </SelectTrigger>
                  <SelectContent>
                    {creditCustomersOnly.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        ✓ All customer accounts are settled (No pending dues)
                      </SelectItem>
                    ) : (
                      creditCustomersOnly.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ""} — Due: ₹{Number(c.outstandingBalance || 0).toLocaleString()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Balance Summary Card */}
              {selectedCustomer && (
                <div className="rounded-xl p-3.5 bg-secondary/30 border border-border/50 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-background">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Total Invoices</p>
                      <p className="text-xs font-bold font-code mt-0.5">₹{customerTotalBilled.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background">
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Already Paid</p>
                      <p className="text-xs font-bold font-code text-green-600 mt-0.5">₹{customerAlreadyPaid.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-orange-500/20">
                      <p className="text-[9px] uppercase font-bold text-orange-500">Balance Due</p>
                      <p className="text-xs font-bold font-code text-orange-500 mt-0.5">₹{Number(selectedCustomer.outstandingBalance || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Credit Bills Section */}
              {selectedCustomerId && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-primary" />
                      <span>Customer Credit Bills</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {customerCreditBills.length} bill(s)
                    </span>
                  </div>

                  {customerCreditBills.length === 0 ? (
                    <div className="p-3 rounded-xl bg-secondary/20 text-center text-xs text-muted-foreground">
                      No sales bills found for this customer.
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-border/50 bg-secondary/15">
                      <Table>
                        <TableHeader className="bg-secondary/30 sticky top-0">
                          <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="text-[9px] font-bold uppercase py-1.5 pl-3">Bill #</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase py-1.5">Date</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase py-1.5">Items</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase py-1.5 text-right">Amount</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase py-1.5 text-right pr-3">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerCreditBills.map((b: any) => {
                            const isPending = b.status === "pending" || b.paymentMethod === "credit"
                            return (
                              <TableRow key={b.id} className="border-border/30 hover:bg-secondary/20">
                                <TableCell className="font-mono text-[10px] font-bold py-1.5 pl-3 text-foreground">
                                  #{b.billNumber || b.id.slice(-6).toUpperCase()}
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground py-1.5">
                                  {b.date ? b.date.split("T")[0] : "—"}
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground py-1.5">
                                  {b.items?.length || 1} item(s)
                                </TableCell>
                                <TableCell className="text-[10px] font-bold py-1.5 text-right font-mono">
                                  ₹{Number(b.total || 0).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right py-1.5 pr-3">
                                  <Badge
                                    variant="outline"
                                    className={
                                      !isPending
                                        ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[8px] font-bold"
                                        : "border-amber-500/30 text-amber-500 bg-amber-500/5 text-[8px] font-bold"
                                    }
                                  >
                                    {!isPending ? "Settled" : "Credit Due"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Amount to collect */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Amount Received (₹) *</Label>
                    {selectedCustomer && Number(selectedCustomer.outstandingBalance) > 0 && (
                      <button
                        type="button"
                        onClick={() => setCollectAmount(String(selectedCustomer.outstandingBalance))}
                        className="text-[10px] text-primary hover:underline font-semibold"
                      >
                        Full Due ({Number(selectedCustomer.outstandingBalance).toLocaleString()})
                      </button>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    className="h-10 text-xs font-bold font-code rounded-xl"
                    placeholder="e.g. 500"
                    value={collectAmount}
                    onChange={e => setCollectAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Payment Mode</Label>
                  <Select value={collectMode} onValueChange={setCollectMode}>
                    <SelectTrigger className="h-10 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Note / Remarks (Optional)</Label>
                <Input
                  className="h-10 text-xs rounded-xl"
                  placeholder="e.g. Cleared pending dues via UPI"
                  value={collectNote}
                  onChange={e => setCollectNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs rounded-xl"
                onClick={() => setCustomerCollectOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCollect || !selectedCustomerId || !Number(collectAmount)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md"
              >
                {isSubmittingCollect && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Record Collection &amp; Reduce Balance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
