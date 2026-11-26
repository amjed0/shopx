"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  EmployeePermissions,
  PermissionKey,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  OWNER_PERMISSIONS,
  normalizePermissions,
} from "../../lib/permissions"

export type ShopRole = "OWNER" | "EMPLOYEE" | null

interface ShopRoleContextValue {
  role: ShopRole
  empName: string | null
  empId: string | null
  permissions: EmployeePermissions
  hasPermission: (key: PermissionKey) => boolean
  loading: boolean
  refreshRole: () => Promise<ShopRole>
  lockShop: () => Promise<void>
}

const ShopRoleContext = React.createContext<ShopRoleContextValue>({
  role: null,
  empName: null,
  empId: null,
  permissions: { ...DEFAULT_EMPLOYEE_PERMISSIONS },
  hasPermission: () => false,
  loading: true,
  refreshRole: async () => null,
  lockShop: async () => {},
})

export function ShopRoleProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const router = useRouter()
  const [role, setRole] = React.useState<ShopRole>(null)
  const [empName, setEmpName] = React.useState<string | null>(null)
  const [empId, setEmpId] = React.useState<string | null>(null)
  const [permissions, setPermissions] = React.useState<EmployeePermissions>({
    ...DEFAULT_EMPLOYEE_PERMISSIONS,
  })
  const [loading, setLoading] = React.useState(true)

  const refreshRole = React.useCallback(async (): Promise<ShopRole> => {
    try {
      const res = await fetch("/api/shop-role/me", {
        cache: "no-store",
        credentials: "include",
      })
      if (!res.ok) {
        setRole(null)
        setEmpName(null)
        setEmpId(null)
        setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS })
        return null
      }
      const data = await res.json()
      const nextRole: ShopRole =
        data.role === "OWNER" || data.role === "EMPLOYEE" ? data.role : null
      setRole(nextRole)
      setEmpName(data.empName ?? null)
      setEmpId(data.empId ?? null)
      if (nextRole === "OWNER") {
        setPermissions({ ...OWNER_PERMISSIONS })
      } else if (nextRole === "EMPLOYEE") {
        setPermissions(normalizePermissions(data.permissions))
      } else {
        setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS })
      }
      return nextRole
    } catch {
      setRole(null)
      setEmpName(null)
      setEmpId(null)
      setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (status === "authenticated") {
      refreshRole()
    } else if (status === "unauthenticated") {
      setRole(null)
      setEmpName(null)
      setEmpId(null)
      setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS })
      setLoading(false)
    }
  }, [status, refreshRole])

  const hasPermission = React.useCallback(
    (key: PermissionKey) => {
      if (role === "OWNER") return true
      if (role === "EMPLOYEE") return Boolean(permissions[key])
      return false
    },
    [role, permissions]
  )

  const lockShop = React.useCallback(async () => {
    try {
      await fetch("/api/shop-role/logout", {
        method: "POST",
        credentials: "include",
      })
    } finally {
      setRole(null)
      setEmpName(null)
      setEmpId(null)
      setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS })
      router.push("/shop-login")
      router.refresh()
    }
  }, [router])

  return (
    <ShopRoleContext.Provider
      value={{
        role,
        empName,
        empId,
        permissions,
        hasPermission,
        loading,
        refreshRole,
        lockShop,
      }}
    >
      {children}
    </ShopRoleContext.Provider>
  )
}

export function useShopRole() {
  return React.useContext(ShopRoleContext)
}
