"use client"

import * as React from "react"
import { 
  Building, 
  MapPin, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Edit, 
  Key,
  Calendar,
  Package,
  ArrowLeft,
  Car,
  Store,
  CheckCircle2,
  Loader2,
  Sparkles,
  FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { isVehicleDealerCategory } from "@/hooks/useShop"

interface ShopData {
  ownerName: string
  companyName: string
  email: string
  phone: string
  location: string
  gstNumber?: string
  businessCategory?: string
  createdAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [shopData, setShopData] = React.useState<ShopData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [updatingCategory, setUpdatingCategory] = React.useState(false)

  // Edit Business Profile Dialog
  const [isEditProfileOpen, setIsEditProfileOpen] = React.useState(false)
  const [editProfileForm, setEditProfileForm] = React.useState({
    ownerName: "",
    companyName: "",
    phone: "",
    email: "",
    location: "",
    gstNumber: "",
  })
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)

  const handleOpenEdit = () => {
    if (!shopData) return
    setEditProfileForm({
      ownerName: shopData.ownerName || "",
      companyName: shopData.companyName || "",
      phone: shopData.phone || "",
      email: shopData.email || "",
      location: shopData.location || "",
      gstNumber: shopData.gstNumber || "",
    })
    setIsEditProfileOpen(true)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) return
    setIsSavingProfile(true)
    try {
      const res = await fetch(`/api/shop_profiles/${session.user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editProfileForm),
      })
      if (!res.ok) throw new Error("Failed to update profile")
      const updated = await res.json()
      setShopData(updated)
      setIsEditProfileOpen(false)
      window.dispatchEvent(new CustomEvent("shop-profile-updated", { detail: updated }))
      toast({ title: "Shop Profile Updated ✓", description: "Business details and GSTIN saved successfully." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message })
    } finally {
      setIsSavingProfile(false)
    }
  }

 React.useEffect(() => {
  if (status === "loading") return
  console.log("Session user id:", session?.user?.id)
  if (!session?.user?.id) {
    setLoading(false)
    return
  }
    const fetchShop = async () => {
      try {
        const res = await fetch(`/api/shop_profiles/${session.user.id}`)
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        setShopData(data)
      } catch (error) {
        console.error("Failed to fetch shop data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchShop()
  }, [session, status])

  const handleUpdateCategory = async (newCategory: string) => {
    if (!session?.user?.id) return
    try {
      setUpdatingCategory(true)
      const res = await fetch(`/api/shop_profiles/${session.user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessCategory: newCategory,
        }),
      })

      if (!res.ok) throw new Error("Failed to update business category")
      const updated = await res.json()
      setShopData(updated)

      window.dispatchEvent(
        new CustomEvent("shop-profile-updated", { detail: updated })
      )

      const isDealer = isVehicleDealerCategory(newCategory)
      toast({
        title: "Category Updated",
        description: isDealer
          ? "Switched to Vehicle Dealers. Product Notes & Renewal options are now unlocked in Inventory."
          : "Switched to Retail Shop mode.",
      })
    } catch (err: any) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update business category.",
      })
    } finally {
      setUpdatingCategory(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!shopData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Shop data not found.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full hover:bg-secondary/50"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">Shop Profile</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage your credentials and shop visibility settings.</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Card className="md:col-span-1 border-none bg-card shadow-sm overflow-hidden h-fit">
          <div className="h-32 bg-gradient-to-br from-primary via-primary/80 to-accent" />
          <CardContent className="pt-0 -mt-16 flex flex-col items-center text-center">
            <Avatar className="w-32 h-32 rounded-3xl border-4 border-background shadow-2xl mb-4">
              <AvatarImage src="https://picsum.photos/seed/shopx-owner/128/128" />
              <AvatarFallback className="rounded-3xl bg-secondary text-4xl font-bold">
                {shopData.ownerName?.charAt(0) ?? "S"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-2xl font-headline font-bold">{shopData.ownerName}</h2>
              <p className="text-sm text-muted-foreground font-medium">Shop Owner & Admin</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Badge className="bg-primary/10 text-primary border-none font-bold uppercase text-[10px]">Active</Badge>
              <Badge className="bg-accent/10 text-accent border-none font-bold uppercase text-[10px]">Verified</Badge>
            </div>
          </CardContent>
          <Separator className="bg-border/50" />
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {shopData.createdAt
                  ? new Date(shopData.createdAt).toLocaleDateString()
                  : "—"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Elite Access Enabled</span>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="font-headline text-xl">Business Identity</CardTitle>
                <CardDescription>Public information about your establishment.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-2 border-border hover:bg-secondary/50 font-bold"
                onClick={handleOpenEdit}
              >
                <Edit className="w-4 h-4" /> Edit Profile
              </Button>
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Company Name</p>
                <div className="flex items-center gap-3 text-foreground font-bold">
                  <Building className="w-4 h-4 text-muted-foreground" />
                  {shopData.companyName}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Shop GST Number (GSTIN)</p>
                <div className="flex items-center gap-3 text-foreground font-bold">
                  <FileText className="w-4 h-4 text-accent" />
                  <span className="font-code text-accent font-bold">
                    {shopData.gstNumber ? shopData.gstNumber : <span className="text-muted-foreground font-normal">Not Registered</span>}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Email Address</p>
                <div className="flex items-center gap-3 text-foreground font-bold">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {shopData.email || "—"}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Phone Number</p>
                <div className="flex items-center gap-3 text-foreground font-bold">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  {shopData.phone || "—"}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Shop Location</p>
                <div className="flex items-center gap-3 text-foreground font-bold">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {shopData.location || "—"}
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2 pt-2 border-t border-border/40">
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Business Category</p>
                <div className="flex items-center gap-3 text-foreground font-bold">
                  {isVehicleDealerCategory(shopData.businessCategory) ? (
                    <Car className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Building className="w-4 h-4 text-primary" />
                  )}
                  <span>
                    {isVehicleDealerCategory(shopData.businessCategory)
                      ? "Vehicle Dealers (Cars & Bikes)"
                      : "Retail Shop (General Retail)"}
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] ml-2 font-bold uppercase",
                    isVehicleDealerCategory(shopData.businessCategory)
                      ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      : "border-primary/40 text-primary bg-primary/10"
                  )}>
                    {isVehicleDealerCategory(shopData.businessCategory) ? "Vehicle Dealer Mode" : "Retail Shop Mode"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Category Switcher Card */}
          <Card className="border-none bg-card shadow-sm">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Business Category Settings
                </CardTitle>
                {updatingCategory && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>Updating...</span>
                  </div>
                )}
              </div>
              <CardDescription>
                Choose your business type. Selecting <strong>Vehicle Dealers</strong> enables special features like Product Notes, renewal dates (Insurance, PUC, Road Tax), and bike/car specs in Inventory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Retail Shop Option */}
                <button
                  type="button"
                  disabled={updatingCategory}
                  onClick={() => handleUpdateCategory("retail")}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all gap-2 relative cursor-pointer",
                    !isVehicleDealerCategory(shopData.businessCategory)
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm"
                      : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40 opacity-75"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Building className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm text-foreground">Retail Shop</span>
                    </div>
                    {!isVehicleDealerCategory(shopData.businessCategory) && (
                      <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ideal for supermarkets, grocery stores, clothing, electronics, and general retail businesses.
                  </p>
                </button>

                {/* Vehicle Dealers Option */}
                <button
                  type="button"
                  disabled={updatingCategory}
                  onClick={() => handleUpdateCategory("vehicle_dealer")}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all gap-2 relative cursor-pointer",
                    isVehicleDealerCategory(shopData.businessCategory)
                      ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20 shadow-sm"
                      : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40 opacity-75"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Car className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm text-foreground">Vehicle Dealers</span>
                    </div>
                    {isVehicleDealerCategory(shopData.businessCategory) && (
                      <Badge className="bg-amber-500 text-white text-[10px] uppercase font-bold">
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tailored for bike & car dealers. Unlocks Product Notes, Insurance / PUC / RC renewal alerts, and vehicle remarks in Inventory.
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-card shadow-sm border-l-4 border-l-accent">
            <CardHeader>
              <CardTitle className="font-headline text-xl flex items-center gap-2">
                <Key className="w-5 h-5 text-accent" />
                Security Status
              </CardTitle>
              <CardDescription>Your account is protected by hardware-grade encryption.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Security Auth Code</p>
                  <p className="text-xs text-muted-foreground">Private ShopX Authorization Active</p>
                </div>
                <Badge variant="outline" className="border-accent/30 text-accent font-code">VALIDATED</Badge>
              </div>
              <Button variant="link" className="text-accent p-0 h-auto font-bold text-xs uppercase tracking-widest">
                Update Password or Auth Code
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-headline text-xl">System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-secondary/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="w-5 h-5 text-primary" />
                    <span className="text-sm font-bold">Plan</span>
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">ELITE ENTERPRISE</span>
                </div>
                <div className="p-4 rounded-xl bg-secondary/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-accent" />
                    <span className="text-sm font-bold">Status</span>
                  </div>
                  <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">ENCRYPTED</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── EDIT BUSINESS IDENTITY & GSTIN DIALOG ── */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveProfile}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Store className="w-5 h-5 text-accent" /> Edit Business Identity
              </DialogTitle>
              <CardDescription>
                Update your store details and GSTIN. These appear on generated customer bills.
              </CardDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shop / Company Name *</Label>
                <Input
                  required
                  placeholder="e.g. ShopX Elite Retail"
                  className="mt-1 h-9 text-xs font-bold"
                  value={editProfileForm.companyName}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shop GST Number (GSTIN)</Label>
                <Input
                  placeholder="e.g. 32AAAAA0000A1Z5"
                  className="mt-1 h-9 text-xs font-code font-bold uppercase tracking-wider"
                  value={editProfileForm.gstNumber}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, gstNumber: e.target.value.toUpperCase() }))}
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Used for bill generation and printed tax receipts.</p>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Owner Name *</Label>
                <Input
                  required
                  placeholder="Owner's Name"
                  className="mt-1 h-9 text-xs"
                  value={editProfileForm.ownerName}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, ownerName: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                  <Input
                    placeholder="e.g. 9876543210"
                    className="mt-1 h-9 text-xs font-code"
                    value={editProfileForm.phone}
                    onChange={e => setEditProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
                  <Input
                    type="email"
                    placeholder="shop@example.com"
                    className="mt-1 h-9 text-xs"
                    value={editProfileForm.email}
                    onChange={e => setEditProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shop Location / Address</Label>
                <Input
                  placeholder="e.g. MG Road, Bengaluru, Karnataka"
                  className="mt-1 h-9 text-xs"
                  value={editProfileForm.location}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setIsEditProfileOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingProfile}
                className="text-xs font-bold bg-accent text-accent-foreground hover:brightness-110"
              >
                {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save Identity
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}