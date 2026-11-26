"use client"

import * as React from "react"
import {
  Users,
  Plus,
  Trash2,
  KeyRound,
  UserCheck,
  UserX,
  Loader2,
  ShieldCheck,
  Phone,
  IdCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { EmployeePermissions } from "../../../../../lib/permissions"
import {
  PermissionBadges,
  EmployeePermissionsPanel,
} from "@/components/employees/employee-permissions-panel"

interface Employee {
  _id: string
  employeeId: string
  name: string
  phone?: string
  isActive: boolean
  permissions?: EmployeePermissions
  createdAt: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = React.useState<Employee[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [openAdd, setOpenAdd] = React.useState(false)

  const [name, setName] = React.useState("")
  const [employeeId, setEmployeeId] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [pin, setPin] = React.useState("")

  const [pinTarget, setPinTarget] = React.useState<Employee | null>(null)
  const [newPin, setNewPin] = React.useState("")
  const [savingPin, setSavingPin] = React.useState(false)

  const fetchEmployees = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/employees", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load employees")
      const data = await res.json()
      setEmployees(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !employeeId.trim() || pin.length < 4) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Name, Employee ID, and a PIN of at least 4 characters are required.",
      })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          employeeId: employeeId.trim().toUpperCase(),
          phone: phone.trim() || undefined,
          pin,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to add employee")
      toast({ title: "Employee Added", description: `${data.name} (${data.employeeId}) can now log in.` })
      setName("")
      setEmployeeId("")
      setPhone("")
      setPin("")
      setOpenAdd(false)
      fetchEmployees()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (emp: Employee) => {
    try {
      const res = await fetch(`/api/employees/${emp._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !emp.isActive }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      toast({
        title: emp.isActive ? "Employee Deactivated" : "Employee Activated",
        description: `${emp.name} is now ${emp.isActive ? "disabled" : "active"}.`,
      })
      fetchEmployees()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    }
  }

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinTarget || newPin.length < 4) {
      toast({ variant: "destructive", title: "Error", description: "PIN must be at least 4 characters." })
      return
    }
    setSavingPin(true)
    try {
      const res = await fetch(`/api/employees/${pinTarget._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin: newPin }),
      })
      if (!res.ok) throw new Error("Failed to update PIN")
      toast({ title: "PIN Updated", description: `New PIN set for ${pinTarget.name}.` })
      setPinTarget(null)
      setNewPin("")
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setSavingPin(false)
    }
  }

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Remove ${emp.name} (${emp.employeeId})?`)) return
    try {
      const res = await fetch(`/api/employees/${emp._id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete employee")
      toast({ title: "Employee Removed", description: `${emp.name} was deleted.` })
      fetchEmployees()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-headline font-bold flex items-center gap-2.5">
            <Users className="w-7 h-7 text-primary" />
            Employee Access &amp; Credentials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create staff IDs and PINs for Stage-2 Employee Login (POS, Sales, Purchases &amp; Stock views only).
          </p>
        </div>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-bold gap-2">
              <Plus className="w-4 h-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Employee Credentials</DialogTitle>
              <DialogDescription>
                Employees use their Employee ID &amp; PIN on the Shop Role screen to enter POS mode.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Employee ID</Label>
                <Input
                  placeholder="e.g. EMP001"
                  className="uppercase"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (Optional)</Label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>PIN / Passcode (min. 4 chars)</Label>
                <Input
                  type="password"
                  placeholder="e.g. 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating} className="w-full sm:w-auto font-bold">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Employee
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Staff Roster ({employees.length})
          </CardTitle>
          <CardDescription>
            Active employees can access New Bill, Sales History, Returns, Purchase Entry, and Product Views.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No employees added yet. Click &ldquo;Add Employee&rdquo; to create staff credentials.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((emp) => (
                <div
                  key={emp._id}
                  className="p-4 rounded-xl border border-border/60 bg-secondary/20 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-base">{emp.name}</p>
                        <p className="text-xs font-mono text-primary font-semibold flex items-center gap-1 mt-0.5">
                          <IdCard className="w-3.5 h-3.5" />
                          {emp.employeeId}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          emp.isActive
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]"
                            : "bg-destructive/10 text-destructive border-destructive/20 text-[10px]"
                        }
                      >
                        {emp.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    {emp.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        {emp.phone}
                      </p>
                    )}
                    <PermissionBadges permissions={emp.permissions} />
                  </div>

                  <EmployeePermissionsPanel
                    employeeId={emp._id}
                    employeeName={emp.name}
                    permissions={emp.permissions}
                    onUpdated={(nextPerms) =>
                      setEmployees((prev) =>
                        prev.map((item) =>
                          item._id === emp._id ? { ...item, permissions: nextPerms } : item
                        )
                      )
                    }
                  />

                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-8 gap-1"
                      onClick={() => {
                        setPinTarget(emp)
                        setNewPin("")
                      }}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      PIN
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-8 gap-1"
                      onClick={() => toggleActive(emp)}
                    >
                      {emp.isActive ? (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          Disable
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Enable
                        </>
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(emp)}
                      title="Delete Employee"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset PIN Dialog */}
      <Dialog open={!!pinTarget} onOpenChange={(v) => !v && setPinTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Employee PIN</DialogTitle>
            <DialogDescription>
              Set a new PIN for {pinTarget?.name} ({pinTarget?.employeeId}).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPin} className="space-y-4">
            <div className="space-y-1.5">
              <Label>New PIN (min. 4 chars)</Label>
              <Input
                type="password"
                placeholder="Enter new PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingPin} className="font-bold">
                {savingPin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save PIN
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
