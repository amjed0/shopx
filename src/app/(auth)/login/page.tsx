"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShieldCheck, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
  const isEmailTouched = email.length > 0
  const isPasswordTouched = password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateEmail(email)) {
      setError("Please enter a valid email address (e.g. name@company.com).")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Invalid credentials. Please try again.")
      }

      toast({
        title: "Access Granted",
        description: "Welcome back to ShopX Elite.",
      })
      router.push("/dashboard")
    } catch (err: any) {
      const msg = err.message || "Invalid credentials. Please try again."
      setError(msg)
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: msg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-[400px] border-none bg-card shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
        <CardHeader className="space-y-4 pt-10">
          <div className="flex justify-center">
            <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
              <ShieldCheck className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-3xl font-headline font-bold">Welcome Back</CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your credentials to access your terminal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider opacity-70">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className={`pl-10 h-12 bg-secondary/30 border-none rounded-xl ${
                      isEmailTouched && !validateEmail(email) ? "ring-2 ring-destructive/60" : ""
                    }`}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {isEmailTouched && !validateEmail(email) && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Invalid email format (e.g. name@company.com)
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider opacity-70">
                    Password
                  </Label>
                  <Link href="#" className="text-[10px] text-primary hover:underline font-bold uppercase">
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 6 characters"
                    className={`pl-10 h-12 bg-secondary/30 border-none rounded-xl ${
                      isPasswordTouched && password.length < 6 ? "ring-2 ring-destructive/60" : ""
                    }`}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {isPasswordTouched && password.length < 6 && (
                  <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Password must be at least 6 characters
                  </p>
                )}
              </div>
            </div>

            {/* General error banner */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                "Authenticating..."
              ) : (
                <span className="flex items-center gap-2">
                  Access Dashboard <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="pb-8">
          <p className="text-center w-full text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary font-bold hover:underline">
              Register your shop
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}