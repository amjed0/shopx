"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShieldCheck, User, Building, MapPin, Mail, Lock, Phone, Key, ArrowRight, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"

const SECURITY_CODE = "Shopx.shop@2026/2003#"

export default function SignupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [securityCode, setSecurityCode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const [formData, setFormData] = React.useState({
    fullName: "",
    companyName: "",
    shopPlace: "",
    email: "",
    phone: "",
    password: "",
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const validatePhone = (phone: string) => /^[+]?[\d\s\-().]{7,15}$/.test(phone.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateEmail(formData.email)) {
      setError("Please enter a valid email address (e.g. name@company.com).")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }

    if (!validatePhone(formData.phone)) {
      setError("Please enter a valid phone number (7–15 digits, optionally with +, spaces, or dashes).")
      return
    }

    if (securityCode !== SECURITY_CODE) {
      setError("Invalid security authorization code.")
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "The security code you entered is incorrect. Public registration is closed.",
      })
      return
    }

    setIsLoading(true)
    try {
      // Step 1: Create user account
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })

      const signupData = await signupRes.json()

      if (!signupRes.ok) {
        throw new Error(signupData.error || "Registration failed.")
      }

      // Step 2: Save shop profile using userId returned from signup
      const userId = signupData.user?.uid
      const profileRes = await fetch(`/api/shop_profiles/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: formData.fullName,
          companyName: formData.companyName,
          location: formData.shopPlace,
          phone: formData.phone,
          email: formData.email,
        }),
      })

      const profileData = await profileRes.json()

      if (!profileRes.ok) {
        // Non-fatal: account created but profile save failed
        console.error("Profile save failed:", profileData.error)
      }

      toast({
        title: "Account Initialized",
        description: "Your shop profile has been created successfully.",
      })
      router.push("/dashboard")
    } catch (err: any) {
      const msg = err.message || "Registration failed."
      setError(msg)
      toast({
        variant: "destructive",
        title: "Registration Error",
        description: msg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-[500px] border-none bg-card shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-accent" />
        <CardHeader className="space-y-4 pt-10">
          <div className="flex justify-center">
            <div className="bg-accent p-3 rounded-2xl shadow-lg shadow-accent/20">
              <ShieldCheck className="w-8 h-8 text-accent-foreground" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl font-headline font-bold">Register Shop</CardTitle>
            <CardDescription className="text-muted-foreground">
              Join the elite ShopX network of smart retailers
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Personal Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    className="pl-10 h-11 bg-secondary/30 border-none rounded-xl text-sm"
                    required
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Company Name
                </Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="companyName"
                    placeholder="Elite Electronics"
                    className="pl-10 h-11 bg-secondary/30 border-none rounded-xl text-sm"
                    required
                    value={formData.companyName}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Shop Location */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="shopPlace" className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Shop Location
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="shopPlace"
                    placeholder="Shop 101, Main Market, Mumbai"
                    className="pl-10 h-11 bg-secondary/30 border-none rounded-xl text-sm"
                    required
                    value={formData.shopPlace}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@shop.com"
                    className={`pl-10 h-11 bg-secondary/30 border-none rounded-xl text-sm ${
                      formData.email && !validateEmail(formData.email) ? "ring-2 ring-destructive/60" : ""
                    }`}
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
                {formData.email && !validateEmail(formData.email) && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Invalid email format (e.g. name@company.com)
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Phone Number
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    className={`pl-10 h-11 bg-secondary/30 border-none rounded-xl text-sm ${
                      formData.phone && !validatePhone(formData.phone) ? "ring-2 ring-destructive/60" : ""
                    }`}
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>
                {formData.phone && !validatePhone(formData.phone) && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Enter 7–15 digits (e.g. +91 98765 43210)
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 6 characters"
                    className={`pl-10 h-11 bg-secondary/30 border-none rounded-xl text-sm ${
                      formData.password && formData.password.length < 6 ? "ring-2 ring-destructive/60" : ""
                    }`}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>
                {formData.password && formData.password.length < 6 && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Password must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Security Code */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="securityCode" className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  Security Auth Code
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                  <Input
                    id="securityCode"
                    type="password"
                    placeholder="Enter Private Code"
                    className="pl-10 h-11 bg-accent/10 border-none rounded-xl text-sm border border-accent/20 focus-visible:ring-accent"
                    required
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-accent text-accent-foreground font-bold rounded-xl shadow-lg shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                "Verifying Authority..."
              ) : (
                <span className="flex items-center gap-2">
                  Initialize Account <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-8">
          <p className="text-center w-full text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="text-accent font-bold hover:underline">
              Sign in instead
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}