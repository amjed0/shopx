"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  ShieldCheck,
  Crown,
  UserCheck,
  Lock,
  IdCard,
  ArrowRight,
  LogOut,
  AlertCircle,
  Loader2,
  Store,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { useShopRole } from "@/hooks/useShopRole"
import { useShop } from "@/hooks/useShop"
import { getDefaultEmployeeRoute } from "../../../lib/permissions"

export default function ShopLoginPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { refreshRole } = useShopRole()
  const userId = session?.user?.id ?? null
  const { data: shopData } = useShop(userId)

  const [mode, setMode] = React.useState<"OWNER" | "EMPLOYEE">("OWNER")
  const [pin, setPin] = React.useState("")
  const [employeeId, setEmployeeId] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) return null

  const handleModeSwitch = (next: "OWNER" | "EMPLOYEE") => {
    setMode(next)
    setError(null)
    setPin("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === "EMPLOYEE" && !employeeId.trim()) {
      setError("Please enter your Employee ID (e.g. EMP001).")
      return
    }
    if (!pin.trim()) {
      setError(
        mode === "OWNER"
          ? "Please enter your Owner password."
          : "Please enter your Employee PIN."
      )
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/shop-role/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode,
          pin,
          employeeId: mode === "EMPLOYEE" ? employeeId.trim().toUpperCase() : undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed")
      }

      await refreshRole()

      toast({
        title: mode === "OWNER" ? "Owner Mode Unlocked" : "Employee Mode Active",
        description:
          mode === "OWNER"
            ? `Welcome back, ${data.name || "Owner"}. Full access granted.`
            : `Signed in as ${data.name} (${data.employeeId}).`,
      })

      if (mode === "OWNER") {
        router.push("/dashboard")
      } else {
        router.push(getDefaultEmployeeRoute(data.permissions))
      }
      router.refresh()
    } catch (err: any) {
      const msg = err.message || "Invalid credentials"
      setError(msg)
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: msg,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleWorkspaceSignOut = async () => {
    await fetch("/api/shop-role/logout", { method: "POST", credentials: "include" }).catch(() => {})
    sessionStorage.removeItem("shopx_session_started")
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-[440px] border-none bg-card shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />

        <CardHeader className="space-y-4 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/20">
                <ShieldCheck className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Stage 2 · Shop Access
                </p>
                <p className="text-sm font-bold flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-primary" />
                  {shopData?.companyName || session.user?.name || "Your Shop"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleWorkspaceSignOut}
              className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
              title="Sign out of Workspace"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </Button>
          </div>

          <div className="text-center space-y-1 pt-2">
            <CardTitle className="text-2xl font-headline font-bold">
              Select Shop Role
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Workspace: <span className="font-semibold text-foreground">{session.user?.email}</span>
            </CardDescription>
          </div>

          {/* Role Toggle Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary/40 rounded-xl">
            <button
              type="button"
              onClick={() => handleModeSwitch("OWNER")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === "OWNER"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Crown className="w-4 h-4" />
              Owner Login
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch("EMPLOYEE")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === "EMPLOYEE"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Employee Login
            </button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "OWNER" ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block mb-0.5">
                    Full Administrative Access
                  </span>
                  Access Dashboard, Accounting, Balance Sheet, Staff Management, and Shop Settings.
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="owner-pin" className="text-xs font-bold uppercase tracking-wider opacity-70">
                    Owner Password (Same as Email Login)
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="owner-pin"
                      type="password"
                      placeholder="Enter your account login password"
                      className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block mb-0.5">
                    POS & Operations Access
                  </span>
                  Access Billing / POS, Sales Entries, Purchase Entries, and Product Stock Views.
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-id" className="text-xs font-bold uppercase tracking-wider opacity-70">
                    Employee ID
                  </Label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="emp-id"
                      type="text"
                      placeholder="e.g. EMP001"
                      className="pl-10 h-12 bg-secondary/30 border-none rounded-xl uppercase"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-pin" className="text-xs font-bold uppercase tracking-wider opacity-70">
                    Employee PIN / Passcode
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="emp-pin"
                      type="password"
                      placeholder="Enter your PIN"
                      className="pl-10 h-12 bg-secondary/30 border-none rounded-xl"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Enter as {mode === "OWNER" ? "Owner" : "Employee"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="pb-6 pt-1 justify-center">
          <p className="text-[11px] text-muted-foreground text-center">
            Employees can get their Employee ID &amp; PIN from the Shop Owner under Management → Employees.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
