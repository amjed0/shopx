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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

  React.useEffect(() => {
    if (!showHistory || !user?.uid) return
    const fetchHistory = async () => {
      try {
        setHistoryLoading(true)
        setPurchaseHistory([])
        const res = await fetch(`/api/purchases?supplierId=${showHistory}`, {
          headers: { "x-user-id": user.uid },
        })

        // ADD THIS — see exact error from server
        if (!res.ok) {
          const errText = await res.text()
          console.error("History API error:", res.status, errText)
          throw new Error(`Failed to fetch history: ${res.status} ${errText}`)
        }

        const data = await res.json()
        setPurchaseHistory(data)
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
        ; (e.target as HTMLFormElement).reset()
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "Could not add supplier.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

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
      </div>

      {/* Stats */}
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

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-accent opacity-50" />
        </div>
      ) : showHistory ? (
        <Card className="border-none bg-card shadow-sm overflow-hidden">
          <CardHeader className="bg-secondary/20 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="font-headline text-xl">
                Purchase History — {selectedSupplier?.name}
              </CardTitle>
              <CardDescription>
                {selectedSupplier?.contactPerson} · {selectedSupplier?.phone}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setShowHistory(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-accent opacity-50" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-secondary/10">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 pl-6">Product Name</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Date</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Quantity</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Purchase Price</TableHead>
                    <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseHistory.length > 0 ? purchaseHistory.map((p, i) => (
                    <TableRow key={i} className="border-border/50 hover:bg-secondary/10 transition-colors">
                      <TableCell className="pl-6 py-4 font-medium">{p.productName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{p.quantity}</TableCell>
                      <TableCell>₹{p.purchasePrice}</TableCell>
                      <TableCell className="text-right pr-6 font-bold">
                        ₹{(p.quantity * p.purchasePrice).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-3 opacity-40">
                          <Truck className="w-10 h-10" />
                          <p className="font-medium">No purchase history found.</p>
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
              <CardTitle className="font-headline text-xl">Vendor Directory</CardTitle>
              <CardDescription>All registered suppliers and their contact details.</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
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
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 pl-6">Vendor Name</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Contact Person</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Communication</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4">Location</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">Edit</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest py-4 text-right pr-6">History</TableHead>
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
                    <TableCell className="font-medium">{s.contactPerson}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" /> {s.phone}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" /> {s.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {s.address}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="sm" className="rounded-full hover:bg-secondary">
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHistory(s.id)}
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}