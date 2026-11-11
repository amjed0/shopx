"use client"

import * as React from "react"

export interface ShopData {
  id?: string
  userId: string
  ownerName: string
  companyName: string
  location?: string
  phone?: string
  email?: string
  businessCategory?: string // 'retail' | 'vehicle_dealer'
  createdAt?: string
}

export function isVehicleDealerCategory(category?: string | null): boolean {
  if (!category) return false
  const normalized = category.toLowerCase().trim()
  return (
    normalized === "vehicle_dealer" ||
    normalized === "vehicle dealers" ||
    normalized === "dealers" ||
    normalized.includes("vehicle")
  )
}

export function useShop(userId: string | null | undefined) {
  const [data, setData] = React.useState<ShopData | null>(null)
  const [loading, setLoading] = React.useState(true)

  const fetchShop = React.useCallback(async () => {
    if (!userId) {
      setData(null)
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const res = await fetch(`/api/shop_profiles/${userId}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch shop profile")
      const json = await res.json()
      setData(json ?? null)
    } catch (err) {
      console.error("Failed to fetch shop:", err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    fetchShop()

    const handleProfileUpdate = (e: any) => {
      if (e.detail) {
        setData(e.detail)
      } else {
        fetchShop()
      }
    }

    window.addEventListener("shop-profile-updated", handleProfileUpdate)
    return () => {
      window.removeEventListener("shop-profile-updated", handleProfileUpdate)
    }
  }, [fetchShop])

  const isVehicleDealer = isVehicleDealerCategory(data?.businessCategory)

  return { data, loading, isVehicleDealer, refetch: fetchShop }
}

