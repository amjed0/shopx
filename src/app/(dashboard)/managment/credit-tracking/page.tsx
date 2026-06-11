"use client"

import * as React from "react"
import {
  IndianRupee,
  Search,
  Loader2,
  User,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  FileText,
  Plus,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useUser } from "@/app/auth/use-user"
import { toast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  outstandingBalance: number
  createdAt: string
}

interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

interface Sale {
  id: string
  date: string
  customerId: string
  customerName: string
  total: number
  status: "paid" | "pending" | "returned"
  paymentMethod: "cash" | "upi" | "card" | "credit"
  items: SaleItem[]
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n)

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

export default function CreditTrackingPage() {
  const { user } = useUser()

  const [loading, setLoading] = React.useState(true)
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [sales, setSales] = React.useState<Sale[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // Dialog state for recording payment
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [submittingPayment, setSubmittingPayment] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const [custRes, salesRes] = await Promise.all([
        fetch("/api/customers", { headers: { "x-user-id": user.uid } }),
        fetch("/api/sales", { headers: { "x-user-id": user.uid } }),
      ])

      if (custRes.ok) {
        const custData = await custRes.json()
        setCustomers(custData)
      }
      if (salesRes.ok) {
        const salesData = await salesRes.json()
        setSales(salesData)
      }
    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Error fetching data",
        description: "Failed to load customers or sales history.",
      })
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const creditCustomers = React.useMemo(() => {
    return customers.filter(c => c.outstandingBalance > 0)
  }, [customers])

  const filteredCustomers = React.useMemo(() => {
    return creditCustomers.filter(
      c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    )
  }, [creditCustomers, searchQuery])

  const creditSales = React.useMemo(() => {
    return sales.filter(s => s.paymentMethod === "credit")
  }, [sales])

  const totalOutstanding = React.useMemo(() => {
    return creditCustomers.reduce((acc, curr) => acc + curr.outstandingBalance, 0)
  }, [creditCustomers])

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCustomer || !user?.uid) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
      })
      return
    }

    if (amount > selectedCustomer.outstandingBalance) {
      toast({
        variant: "destructive",
        title: "Excess Payment",
        description: `Payment amount cannot exceed outstanding balance of ${formatCurrency(selectedCustomer.outstandingBalance)}.`,
      })
      return
    }

    setSubmittingPayment(true)
    try {
      const newBalance = selectedCustomer.outstandingBalance - amount
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify({ outstandingBalance: newBalance }),
      })

      if (!res.ok) throw new Error("Failed to record payment")

      toast({
        title: "Payment Recorded",
        description: `Successfully cleared ${formatCurrency(amount)} for ${selectedCustomer.name}.`,
      })
      
      setCustomers(prev =>
        prev.map(c => (c.id === selectedCustomer.id ? { ...c, outstandingBalance: newBalance } : c))
      )
      
      if (newBalance === 0) {
        const pendingCustomerSales = creditSales.filter(s => s.customerId === selectedCustomer.id && s.status === "pending")
        for (const sale of pendingCustomerSales) {
          await fetch(`/api/sales/${sale.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": user.uid,
            },
            body: JSON.stringify({ status: "paid" }),
          }).catch(console.error)
        }
        fetchData()
      }

      setSelectedCustomer(null)
      setPaymentAmount("")
    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Error updating customer",
        description: "Failed to record payment.",
      })
    } finally {
      setSubmittingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground">Credit Tracking</h1>
          <p className="text-muted-foreground">Manage customer outstanding balances and payment logs.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-none bg-card shadow-sm p-6 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Credit Outstanding</p>
            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-orange-500" />
            </div>
          </div>
          <p className="text-3xl font-bold font-headline text-orange-500">{formatCurrency(totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground">{creditCustomers.length} active customer ledgers</p>
        </Card>

        <Card className="border-none bg-card shadow-sm p-6 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pending Bills</p>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="text-3xl font-bold font-headline text-amber-500">
            {creditSales.filter(s => s.status === "pending").length}
          </p>
          <p className="text-xs text-muted-foreground">Sales waiting for settlement</p>
        </Card>

        <Card className="border-none bg-card shadow-sm p-6 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Settled Bills</p>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-3xl font-bold font-headline text-emerald-500">
            {creditSales.filter(s => s.status === "paid").length}
          </p>
          <p className="text-xs text-muted-foreground">Credit sales fully cleared</p>
        </Card>
      </div>

      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-headline text-lg">Customer Credit Ledger</CardTitle>
            <CardDescription>Customers currently holding outstanding credit balances.</CardDescription>
          </div>
          <div className="relative w-full max-w-xs flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary/30 border-none rounded-xl text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "No matching customers found." : "No customers have outstanding credit balances."}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold uppercase text-[10px]">Customer</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Phone Number</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Created Date</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Outstanding Balance</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map(c => (
                  <TableRow key={c.id} className="border-border/30 hover:bg-secondary/5">
                    <TableCell className="font-medium text-sm flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold">{c.name}</p>
                        {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                    <TableCell className="font-bold text-orange-500">{formatCurrency(c.outstandingBalance)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => setSelectedCustomer(c)}
                        className="bg-primary hover:bg-primary/90 rounded-full text-xs"
                      >
                        Record Payment
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-none bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-lg">Recent Credit Bills</CardTitle>
          <CardDescription>Sales recorded as shop credit.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {creditSales.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No credit sales bills recorded yet.</div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-bold uppercase text-[10px]">Bill ID</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Date</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Customer</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Items Count</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Amount</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditSales.slice(0, 15).map(s => (
                  <TableRow key={s.id} className="border-border/30 hover:bg-secondary/5">
                    <TableCell className="font-bold text-xs uppercase text-muted-foreground">#{s.id.slice(-6)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(s.date)}</TableCell>
                    <TableCell className="font-medium text-sm">{s.customerName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.items.length} items</TableCell>
                    <TableCell className="font-bold">{formatCurrency(s.total)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={s.status === "paid" ? "outline" : "secondary"}
                        className={
                          s.status === "paid"
                            ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5 text-[9px]"
                            : "border-amber-500/30 text-amber-500 bg-amber-500/5 text-[9px]"
                        }
                      >
                        {s.status === "paid" ? "Settled" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomer} onOpenChange={open => !open && setSelectedCustomer(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl bg-card border-none">
          <form onSubmit={handleRecordPayment}>
            <DialogHeader>
              <DialogTitle className="text-xl font-headline font-bold">Record Customer Payment</DialogTitle>
              <DialogDescription>
                Record payment received from {selectedCustomer?.name}. This will reduce their outstanding credit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-muted-foreground">Current Credit Balance</p>
                <p className="text-2xl font-bold text-orange-500 font-headline">
                  {selectedCustomer ? formatCurrency(selectedCustomer.outstandingBalance) : "₹0"}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="amount" className="text-sm font-bold">
                  Amount Received (₹)
                </label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="e.g. 500"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="bg-secondary/30 border-none rounded-xl"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedCustomer(null)}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingPayment}
                className="bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-6 rounded-full"
              >
                {submittingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...
                  </>
                ) : (
                  "Record Payment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
