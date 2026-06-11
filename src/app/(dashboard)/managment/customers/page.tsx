"use client"

import * as React from "react"
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  Search,
  Edit2,
  Loader2,
  ArrowLeft,
  ShoppingCart,
  IndianRupee,
  ShieldAlert,
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
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useUser } from "@/app/auth/use-user"
import { toast } from "@/hooks/use-toast"

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  outstandingBalance: number
  createdAt: string
}

export default function CustomersPage() {
  const router = useRouter()
  const { user } = useUser()
  
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // Dialog state for add customer
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  // Dialog state for edit customer
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null)
  
  // Show history state
  const [showHistory, setShowHistory] = React.useState<string | false>(false)
  const [customerSales, setCustomerSales] = React.useState<any[]>([])
  const [salesLoading, setSalesLoading] = React.useState(false)

  const fetchCustomers = React.useCallback(async () => {
    if (!user?.uid) return
    try {
      setLoading(true)
      const res = await fetch("/api/customers", {
        headers: { "x-user-id": user.uid },
      })
      if (!res.ok) throw new Error("Failed to fetch customers")
      const data = await res.json()
      setCustomers(data)
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Could not load customers.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  React.useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  React.useEffect(() => {
    if (!showHistory || !user?.uid) return
    const fetchHistory = async () => {
      try {
        setSalesLoading(true)
        setCustomerSales([])
        const res = await fetch(`/api/sales`, {
          headers: { "x-user-id": user.uid },
        })
        if (!res.ok) throw new Error("Failed to fetch sales history")
        const allSales = await res.json()
        const filteredSales = allSales.filter((s: any) => s.customerId === showHistory)
        setCustomerSales(filteredSales)
      } catch (err) {
        console.error(err)
        toast({ title: "Error", description: "Could not load purchase history.", variant: "destructive" })
      } finally {
        setSalesLoading(false)
      }
    }
    fetchHistory()
  }, [showHistory, user?.uid])

  const filtered = React.useMemo(() => {
    const q = searchQuery.toLowerCase()
    if (!q) return customers
    return customers.filter(
      c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    )
  }, [customers, searchQuery])

  const stats = React.useMemo(() => {
    const total = customers.length
    const todayStr = new Date().toISOString().split("T")[0]
    const newToday = customers.filter(c => c.createdAt?.startsWith(todayStr)).length
    const withCredit = customers.filter(c => c.outstandingBalance > 0).length
    return { total, newToday, withCredit }
  }, [customers])

  const selectedCustomer = customers.find(c => c.id === showHistory)

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid) return
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    const customerData = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
      outstandingBalance: Number(formData.get("outstandingBalance") || 0),
    }

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify(customerData),
      })
      if (!res.ok) throw new Error("Failed to add customer")
      const newCust = await res.json()
      setCustomers(prev => [newCust, ...prev])
      toast({ title: "Customer Registered", description: `${customerData.name} has been added.` })
      setIsAddOpen(false)
      ;(e.target as HTMLFormElement).reset()
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Could not add customer.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid || !editingCustomer) return
    setIsSubmitting(true)
    const formData = new FormData(e.currentTarget)

    const customerData = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: formData.get("email") as string,
    }

    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        body: JSON.stringify(customerData),
      })
      if (!res.ok) throw new Error("Failed to update customer")
      const updatedCust = await res.json()
      setCustomers(prev => prev.map(c => (c.id === editingCustomer.id ? { ...c, ...updatedCust } : c)))
      toast({ title: "Customer Updated", description: `${customerData.name} has been updated.` })
      setEditingCustomer(null)
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Could not update customer.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n)

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
              Customer <span className="text-primary">Registry</span>
            </h1>
            <p className="text-muted-foreground">Manage customer records, contact details, and transactions.</p>
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-2 font-bold px-8 py-6 rounded-full shadow-lg shadow-primary/20">
              <UserPlus className="w-5 h-5" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl bg-card border-none">
            <form onSubmit={handleAdd}>
              <DialogHeader>
                <DialogTitle>Register New Customer</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" placeholder="e.g. John Doe" required className="bg-secondary/30 border-none rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" name="phone" placeholder="Phone" required className="bg-secondary/30 border-none rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="john@example.com" className="bg-secondary/30 border-none rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="outstandingBalance">Opening Credit Balance (Optional)</Label>
                  <Input
                    id="outstandingBalance"
                    name="outstandingBalance"
                    type="number"
                    defaultValue="0"
                    placeholder="e.g. 1500"
                    className="bg-secondary/30 border-none rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-full"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {isSubmitting ? "Saving..." : "Initialize Customer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Customers</p>
              <p className="text-2xl font-bold font-headline">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-accent/10 p-3 rounded-xl">
              <UserPlus className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Registered Today</p>
              <p className="text-2xl font-bold font-headline">{stats.newToday}</p>
            </div>
          </div>
        </Card>
        <Card className="border-none bg-card shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="bg-orange-500/10 p-3 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">With Credit Balance</p>
              <p className="text-2xl font-bold font-headline">{stats.withCredit}</p>
            </div>
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        </div>
      ) : showHistory ? (
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="font-headline text-xl">
                Purchase History — {selectedCustomer?.name}
              </CardTitle>
              <CardDescription>
                {selectedCustomer?.phone} {selectedCustomer?.email && `· ${selectedCustomer?.email}`}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setShowHistory(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Directory
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {salesLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-secondary/10">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 pl-6">Bill ID</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Date</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Items Count</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Method</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerSales.length > 0 ? customerSales.map((sale) => (
                    <TableRow key={sale.id} className="border-border/50 hover:bg-secondary/10 transition-colors">
                      <TableCell className="pl-6 py-4 font-bold text-xs uppercase text-muted-foreground">
                        #{sale.id.slice(-6)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(sale.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{sale.items.length} items</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {sale.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold">
                        {formatCurrency(sale.total)}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-3 opacity-40">
                          <ShoppingCart className="w-10 h-10" />
                          <p className="font-medium">No sales bills found for this customer.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="font-headline text-xl">Customer Directory</CardTitle>
              <CardDescription>A list of all registered customers and their contact cards.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                className="pl-9 h-9 w-72 bg-secondary/50 border-none rounded-full"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-secondary/10">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 pl-6">Customer Name</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Phone</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Email</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Outstanding credit</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">Edit</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">History</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} className="border-border/50 hover:bg-secondary/10 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{c.phone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell>
                      {c.outstandingBalance > 0 ? (
                        <span className="font-bold text-orange-500">{formatCurrency(c.outstandingBalance)}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Clear</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full hover:bg-secondary"
                        onClick={() => setEditingCustomer(c)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHistory(c.id)}
                      >
                        View Bills
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                      <div className="flex flex-col items-center gap-3 opacity-40">
                        <Users className="w-10 h-10" />
                        <p className="font-medium">No customers found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Customer Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={open => !open && setEditingCustomer(null)}>
        <DialogContent className="rounded-2xl bg-card border-none">
          {editingCustomer && (
            <form onSubmit={handleEdit}>
              <DialogHeader>
                <DialogTitle>Edit Customer Info</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingCustomer.name}
                    required
                    className="bg-secondary/30 border-none rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="edit-phone">Phone Number</Label>
                    <Input
                      id="edit-phone"
                      name="phone"
                      defaultValue={editingCustomer.phone}
                      required
                      className="bg-secondary/30 border-none rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      name="email"
                      type="email"
                      defaultValue={editingCustomer.email || ""}
                      className="bg-secondary/30 border-none rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-full"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Edit2 className="w-4 h-4 mr-2" />
                  )}
                  {isSubmitting ? "Saving..." : "Update Customer"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}