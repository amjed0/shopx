"use client"

import * as React from "react"
import { Shield, ChevronDown, ChevronUp, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"
import {
  EmployeePermissions,
  PermissionKey,
  PERMISSION_META,
  normalizePermissions,
} from "../../../lib/permissions"

export function PermissionBadges({
  permissions,
}: {
  permissions?: Partial<EmployeePermissions> | null
}) {
  const perms = normalizePermissions(permissions)
  const enabledMeta = PERMISSION_META.filter((m) => perms[m.key])

  if (enabledMeta.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground italic">
        No modules enabled
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {enabledMeta.map((m) => (
        <Badge
          key={m.key}
          variant="outline"
          className={
            m.tier === "advanced"
              ? "bg-primary/10 text-primary border-primary/25 text-[10px] px-1.5 py-0 font-semibold"
              : "bg-secondary/60 text-muted-foreground border-border/60 text-[10px] px-1.5 py-0 font-medium"
          }
        >
          {m.shortLabel}
        </Badge>
      ))}
    </div>
  )
}

export function EmployeePermissionsPanel({
  employeeId,
  employeeName,
  permissions,
  onUpdated,
  defaultExpanded = false,
}: {
  employeeId: string
  employeeName: string
  permissions?: Partial<EmployeePermissions> | null
  onUpdated: (next: EmployeePermissions) => void
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded)
  const [savingKey, setSavingKey] = React.useState<PermissionKey | null>(null)
  const perms = normalizePermissions(permissions)

  const handleToggle = async (key: PermissionKey, checked: boolean) => {
    const nextPerms: EmployeePermissions = { ...perms, [key]: checked }
    setSavingKey(key)
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissions: { [key]: checked } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to update permission")

      onUpdated(normalizePermissions(data.permissions ?? nextPerms))
      const meta = PERMISSION_META.find((m) => m.key === key)
      toast({
        title: "Access Updated",
        description: `${meta?.shortLabel ?? key} ${checked ? "enabled" : "disabled"} for ${employeeName}.`,
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "Could not update permission.",
      })
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="pt-2 border-t border-border/40">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExpanded((v) => !v)}
        className="w-full justify-between h-8 px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-primary" />
          Manage Access Permissions
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </Button>

      {expanded && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2 p-2.5 rounded-xl bg-background/60 border border-border/50">
          {PERMISSION_META.map((item) => {
            const isChecked = perms[item.key]
            const isSaving = savingKey === item.key
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold truncate">{item.label}</span>
                    {item.tier === "advanced" && (
                      <span className="text-[9px] uppercase font-bold px-1 rounded bg-amber-500/10 text-amber-500">
                        Extra
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  <Switch
                    checked={isChecked}
                    disabled={savingKey !== null}
                    onCheckedChange={(val) => handleToggle(item.key, val)}
                    aria-label={`Toggle ${item.label} for ${employeeName}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
