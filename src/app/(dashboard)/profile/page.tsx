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
  ArrowLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

interface ShopData {
  ownerName: string
  companyName: string
  email: string
  phone: string
  location: string
  createdAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [shopData, setShopData] = React.useState<ShopData | null>(null)
  const [loading, setLoading] = React.useState(true)

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
          <h1 className="text-4xl font-headline font-bold text-foreground">Shop Profile</h1>
          <p className="text-muted-foreground">Manage your credentials and shop visibility settings.</p>
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
                onClick={() => router.push("/profile/edit")}
              >
                <Edit className="w-4 h-4" /> Edit
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
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Shop Location</p>
                <div className="flex items-center gap-3 text-foreground font-bold">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {shopData.location || "—"}
                </div>
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
    </div>
  )
}