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
  BarChart3,
  History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

// ─── Constants ───────────────────────────────────────────────────────────────

const INCOME_CATEGORIES = [
  "Sales",
  "Service Revenue",
  "Refund Received",
  "Investment",
  "Loan Received",
  "Commission",
  "Rental Income",
  "Other Income",
]

const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Salaries",
  "Transport",
  "Maintenance",
  "Marketing",
  "Miscellaneous",
  "Office Supplies",
  "Food & Beverage",
  "Internet & Phone",
  "Purchase / Stock",
]

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque"]

type EntryType = "income" | "expense"

// ─── Types ───────────────────────────────────────────────────────────────────

interface CashbookItem {
  id: string
  type: EntryType
  category: string
  description: string
  amount: number
  paymentMode: string
  note: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyItem = (type: EntryType = "expense"): CashbookItem => ({
  id: Math.random().toString(36).slice(2),
  type,
  category: "",
  description: "",
  amount: 0,
  paymentMode: "Cash",
  note: "",
})

const fmt = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Component ───────────────────────────────────────────────────────────────

export default function CashbookPage() {
  const { user } = useUser()

  const [items, setItems] = React.useState<CashbookItem[]>([emptyItem("income")])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [customCategory, setCustomCategory] = React.useState<Record<string, boolean>>({})
  const [defaultType, setDefaultType] = React.useState<EntryType>("expense")

  // ── Derived ─────────────────────────────────────────────────────────────

  const totalIncome = items
    .filter(i => i.type === "income")
    .reduce((acc, i) => acc + (Number(i.amount) || 0), 0)

  const totalExpense = items
    .filter(i => i.type === "expense")
    .reduce((acc, i) => acc + (Number(i.amount) || 0), 0)

  const balance = totalIncome - totalExpense
  const isValid = items.every(i => i.category && i.description && Number(i.amount) > 0)

  // ── Row actions ─────────────────────────────────────────────────────────

  const addRow = (type: EntryType = defaultType) =>
    setItems(prev => [...prev, emptyItem(type)])

  const removeRow = (id: string) =>
    setItems(prev => (prev.length === 1 ? prev : prev.filter(i => i.id !== id)))

  const updateItem = (id: string, field: keyof CashbookItem, value: unknown) =>
    setItems(prev =>
      prev.map(i => {
        if (i.id !== id) return i
        // Reset category when type changes
        if (field === "type") return { ...i, type: value as EntryType, category: "" }
        return { ...i, [field]: value }
      })
    )

    const router = useRouter()

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!user?.uid || !isValid) return
    setIsSubmitting(true)
    try {
      await Promise.all(
        items.map(item =>
          fetch("/api/cashbook", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": user.uid,
            },
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
        title: "Cashbook Updated",
        description: `${items.length} entr${items.length > 1 ? "ies" : "y"} recorded successfully.`,
      })
      setItems([emptyItem("expense")])
      setCustomCategory({})
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Failed",
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-headline font-bold">
            Cash <span className="text-accent">Book</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Record income and expenses in one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="rounded-xl font-bold uppercase tracking-wider text-[10px]"
            onClick={() => router.push("/accounting/cashbook/history")}
          >
            <History className="w-3.5 h-3.5 mr-1.5" />
            History
          </Button>
          <Button
            variant="outline"
            className="rounded-xl font-bold uppercase tracking-wider text-[10px]"
            onClick={() => {
              setItems([emptyItem("expense")])
              setCustomCategory({})
            }}
            disabled={items.length === 1 && !items[0].category}
          >
            Clear
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-accent text-accent-foreground font-bold px-8 rounded-xl shadow-lg shadow-accent/20"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Entries
          </Button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Entries */}
        <Card className="border-none bg-card shadow-sm p-4 flex items-center gap-3">
          <div className="bg-accent/10 p-2.5 rounded-xl">
            <BookOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Entries
            </p>
            <p className="text-2xl font-bold">{items.length}</p>
          </div>
        </Card>

        {/* Income */}
        <Card className="border-none bg-card shadow-sm p-4 flex items-center gap-3">
          <div className="bg-green-500/10 p-2.5 rounded-xl">
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Income
            </p>
            <p className="text-2xl font-bold font-code text-green-500">
              {fmt(totalIncome)}
            </p>
          </div>
        </Card>

        {/* Expense */}
        <Card className="border-none bg-card shadow-sm p-4 flex items-center gap-3">
          <div className="bg-destructive/10 p-2.5 rounded-xl">
            <TrendingDown className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Expense
            </p>
            <p className="text-2xl font-bold font-code text-destructive">
              {fmt(totalExpense)}
            </p>
          </div>
        </Card>

        {/* Balance */}
        <Card className="border-none bg-card shadow-sm p-4 flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              balance >= 0 ? "bg-primary/10" : "bg-destructive/10"
            }`}
          >
            <IndianRupee
              className={`w-5 h-5 ${
                balance >= 0 ? "text-primary" : "text-destructive"
              }`}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Balance
            </p>
            <p
              className={`text-2xl font-bold font-code ${
                balance >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {fmt(balance)}
            </p>
          </div>
        </Card>
      </div>

      {/* ── Cashbook Sheet ── */}
      <Card className="border-none bg-card shadow-xl overflow-hidden">
        <CardHeader className="bg-secondary/20 border-b border-border/50 py-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-accent" />
            <div>
              <CardTitle className="text-lg">Cashbook Sheet</CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Bulk income &amp; expense recorder
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => addRow("income")}
              variant="outline"
              size="sm"
              className="rounded-xl text-[10px] font-bold uppercase tracking-widest border-green-500/30 text-green-500 hover:bg-green-500/10"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 mr-1" /> Income
            </Button>
            <Button
              onClick={() => addRow("expense")}
              variant="outline"
              size="sm"
              className="rounded-xl text-[10px] font-bold uppercase tracking-widest border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <ArrowUpCircle className="w-3.5 h-3.5 mr-1" /> Expense
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/10">
              <TableRow className="border-border/50">
                <TableHead className="w-8 text-center text-[10px] font-bold uppercase py-3">
                  #
                </TableHead>
                <TableHead className="w-[120px] text-[10px] font-bold uppercase py-3">
                  <span className="flex items-center gap-1">
                    <ArrowDownCircle className="w-3 h-3" /> Type
                  </span>
                </TableHead>
                <TableHead className="w-[160px] text-[10px] font-bold uppercase py-3">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Category
                  </span>
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase py-3">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Description
                  </span>
                </TableHead>
                <TableHead className="w-[130px] text-[10px] font-bold uppercase py-3">
                  <span className="flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" /> Amount
                  </span>
                </TableHead>
                <TableHead className="w-[140px] text-[10px] font-bold uppercase py-3">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Payment
                  </span>
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase py-3">
                  <span className="flex items-center gap-1">
                    <StickyNote className="w-3 h-3" /> Note
                  </span>
                </TableHead>
                <TableHead className="w-10 py-3" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((item, index) => {
                const isIncome = item.type === "income"
                const cats = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

                return (
                  <TableRow
                    key={item.id}
                    className="border-border/30 group hover:bg-secondary/5"
                  >
                    {/* # */}
                    <TableCell className="text-center font-code text-xs text-muted-foreground">
                      {index + 1}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      <Select
                        value={item.type}
                        onValueChange={val =>
                          updateItem(item.id, "type", val as EntryType)
                        }
                      >
                        <SelectTrigger
                          className={`h-8 text-xs border-none font-bold ${
                            isIncome
                              ? "bg-green-500/10 text-green-600"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">
                            <span className="flex items-center gap-1.5 text-green-600">
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

                    {/* Category */}
                    <TableCell>
                      {customCategory[item.id] ? (
                        <div className="flex gap-1">
                          <Input
                            autoFocus
                            placeholder="Category..."
                            className="h-8 text-xs bg-secondary/20 border-none"
                            value={item.category}
                            onChange={e =>
                              updateItem(item.id, "category", e.target.value)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() =>
                              setCustomCategory(p => ({ ...p, [item.id]: false }))
                            }
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
                            } else {
                              updateItem(item.id, "category", val)
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
                    </TableCell>

                    {/* Description */}
                    <TableCell>
                      <Input
                        placeholder="What was this for?"
                        className="h-8 text-xs bg-secondary/20 border-none"
                        value={item.description}
                        onChange={e =>
                          updateItem(item.id, "description", e.target.value)
                        }
                      />
                    </TableCell>

                    {/* Amount */}
                    <TableCell>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">
                          ₹
                        </span>
                        <Input
                          type="number"
                          className="h-8 text-xs bg-secondary/20 border-none font-bold pl-6"
                          value={item.amount || ""}
                          onChange={e =>
                            updateItem(item.id, "amount", e.target.value)
                          }
                          placeholder="0"
                        />
                      </div>
                    </TableCell>

                    {/* Payment Mode */}
                    <TableCell>
                      <Select
                        value={item.paymentMode}
                        onValueChange={val =>
                          updateItem(item.id, "paymentMode", val)
                        }
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

                    {/* Note */}
                    <TableCell>
                      <Input
                        placeholder="Optional note..."
                        className="h-8 text-xs bg-secondary/20 border-none"
                        value={item.note}
                        onChange={e =>
                          updateItem(item.id, "note", e.target.value)
                        }
                      />
                    </TableCell>

                    {/* Remove */}
                    <TableCell>
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
        </CardContent>

        {/* Footer — totals row */}
        <CardContent className="bg-secondary/10 border-t border-border/50 py-3 px-6">
          {isValid ? (
            <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-accent">
                <CheckCircle2 className="w-3.5 h-3.5" /> All entries complete — Ready to Commit
              </span>
              <div className="flex items-center gap-6">
                <span className="text-green-500">
                  IN &nbsp;{fmt(totalIncome)}
                </span>
                <span className="text-destructive">
                  OUT &nbsp;{fmt(totalExpense)}
                </span>
                <span className={balance >= 0 ? "text-primary" : "text-destructive"}>
                  BAL &nbsp;{fmt(balance)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              <span>Fill all required fields to continue</span>
              <div className="flex items-center gap-6">
                <span className="text-green-500">IN &nbsp;{fmt(totalIncome)}</span>
                <span className="text-destructive">OUT &nbsp;{fmt(totalExpense)}</span>
                <span className={balance >= 0 ? "text-primary" : "text-destructive"}>
                  BAL &nbsp;{fmt(balance)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}