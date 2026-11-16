// Shared by the Purchase Entry page and the Purchase History page.
// Save this file as:  src/lib/purchase-bills.ts
//
// Your database stores one purchase record per item row. This file groups those rows
// back into BILLS, so both pages show exactly the same bill numbers, totals and balances.
//
// How a bill is identified:
//   1. If the purchase rows have a `billId` field (saved by the new Purchase Entry page),
//      all rows with the same billId are one bill.
//   2. Older rows without a billId are grouped by supplier + bill date, and then split
//      into separate bills when they were saved more than 3 minutes apart.

export interface PurchaseRecord {
  id: string
  supplierId: string
  productId: string
  productName: string
  itemCode?: string
  quantity: number
  purchasePrice: number
  taxRate?: number
  taxAmount?: number
  billingDate?: string
  createdAt?: string
  billId?: string
  billTotal?: number
  paidAmount?: number
  discount?: number
  roundOff?: number
  paymentMode?: string
}

export interface SupplierPaymentRecord {
  supplierId?: string
  amount?: number
  note?: string
  [key: string]: any
}

export interface SupplierLite {
  id: string
  _id?: string
  name: string
  phone?: string
}

export interface Bill {
  key: string              // stable id, used in the ?bill= link
  billNumber: number       // 1 = oldest bill
  date: string             // YYYY-MM-DD
  supplierId: string
  supplierName: string
  supplierPhone: string
  items: PurchaseRecord[]
  totalQty: number
  subtotal: number         // sum of (qty x cost + GST)
  discount: number
  roundOff: number
  totalAmount: number      // final bill total
  paid: number | null      // null = could not be worked out
  balance: number | null
  paymentMode?: string
  createdAt: string
}

const CLUSTER_GAP_MS = 3 * 60 * 1000

const round2 = (n: number) => Math.round(n * 100) / 100

export function toArray<T = any>(json: any): T[] {
  if (Array.isArray(json)) return json
  if (json && typeof json === "object") {
    for (const k of ["purchases", "payments", "data", "items", "results"]) {
      if (Array.isArray(json[k])) return json[k]
    }
  }
  return []
}

export function normalizeRecord(p: any, idx = 0): PurchaseRecord {
  return {
    ...p,
    id: String(p?.id ?? p?._id ?? `row-${idx}`),
    supplierId: String(p?.supplierId ?? ""),
    productId: String(p?.productId ?? ""),
    productName: String(p?.productName ?? "Product"),
    itemCode: p?.itemCode ? String(p.itemCode) : undefined,
    quantity: Number(p?.quantity) || 0,
    purchasePrice: Number(p?.purchasePrice) || 0,
    taxRate: Number(p?.taxRate) || 0,
    taxAmount: Number(p?.taxAmount) || 0,
    billingDate: p?.billingDate ? String(p.billingDate).split("T")[0] : undefined,
    createdAt: p?.createdAt ? String(p.createdAt) : "",
    billId: p?.billId ? String(p.billId) : undefined,
  }
}

const dateOf = (r: PurchaseRecord) =>
  r.billingDate || (r.createdAt ? r.createdAt.split("T")[0] : "Unknown")

const tsOf = (r: PurchaseRecord) => {
  const t = Date.parse(r.createdAt || "")
  return Number.isFinite(t) ? t : 0
}

const byCreated = (a: PurchaseRecord, b: PurchaseRecord) =>
  tsOf(a) - tsOf(b) || a.id.localeCompare(b.id)

const lineTotal = (r: PurchaseRecord) =>
  (Number(r.quantity) || 0) * (Number(r.purchasePrice) || 0) + (Number(r.taxAmount) || 0)

function pickNumber(items: PurchaseRecord[], field: keyof PurchaseRecord): number | undefined {
  for (const it of items) {
    const v = (it as any)[field]
    if (v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v))) return Number(v)
  }
  return undefined
}

function pickString(items: PurchaseRecord[], field: keyof PurchaseRecord): string | undefined {
  for (const it of items) {
    const v = (it as any)[field]
    if (typeof v === "string" && v.trim()) return v
  }
  return undefined
}

export function groupPurchasesIntoBills(
  rawPurchases: unknown[],
  payments: SupplierPaymentRecord[] | null,
  suppliers: SupplierLite[] = []
): Bill[] {
  // 1. normalise + remove duplicate rows
  const seen = new Set<string>()
  const records: PurchaseRecord[] = []
  rawPurchases.forEach((p, i) => {
    const r = normalizeRecord(p, i)
    if (seen.has(r.id)) return
    seen.add(r.id)
    records.push(r)
  })

  // 2. split into groups
  const groups: { key: string; items: PurchaseRecord[] }[] = []

  const byBillId = new Map<string, PurchaseRecord[]>()
  const loose: PurchaseRecord[] = []
  records.forEach(r => {
    if (r.billId) {
      const list = byBillId.get(r.billId) ?? []
      list.push(r)
      byBillId.set(r.billId, list)
    } else {
      loose.push(r)
    }
  })
  byBillId.forEach((items, key) => groups.push({ key, items: [...items].sort(byCreated) }))

  const buckets = new Map<string, PurchaseRecord[]>()
  loose.forEach(r => {
    const k = `${r.supplierId}__${dateOf(r)}`
    const list = buckets.get(k) ?? []
    list.push(r)
    buckets.set(k, list)
  })
  buckets.forEach(rows => {
    const sorted = [...rows].sort(byCreated)
    let cluster: PurchaseRecord[] = []
    let lastTs = 0
    const flush = () => {
      if (cluster.length) groups.push({ key: `r_${cluster[0].id}`, items: cluster })
      cluster = []
    }
    sorted.forEach(r => {
      const ts = tsOf(r)
      if (cluster.length && ts && lastTs && ts - lastTs > CLUSTER_GAP_MS) flush()
      cluster.push(r)
      if (ts) lastTs = ts
    })
    flush()
  })

  // 3. build bills
  const supplierById = new Map<string, SupplierLite>()
  suppliers.forEach(s => {
    supplierById.set(String(s.id), s)
    if (s._id) supplierById.set(String(s._id), s)
  })

  const bills: Bill[] = groups.map(g => {
    const first = g.items[0]
    const supp = supplierById.get(first.supplierId)
    const subtotal = round2(g.items.reduce((a, r) => a + lineTotal(r), 0))
    const discount = pickNumber(g.items, "discount") ?? 0
    const roundOff = pickNumber(g.items, "roundOff") ?? 0
    const storedTotal = pickNumber(g.items, "billTotal")
    const totalAmount = round2(storedTotal !== undefined ? storedTotal : subtotal - discount + roundOff)
    const created = g.items.map(r => r.createdAt || "").filter(Boolean).sort()[0] || ""
    return {
      key: g.key,
      billNumber: 0,
      date: dateOf(first),
      supplierId: first.supplierId,
      supplierName: supp?.name || "Unknown Supplier",
      supplierPhone: supp?.phone || "",
      items: g.items,
      totalQty: g.items.reduce((a, r) => a + (Number(r.quantity) || 0), 0),
      subtotal,
      discount,
      roundOff,
      totalAmount,
      paid: pickNumber(g.items, "paidAmount") ?? null,
      balance: null,
      paymentMode: pickString(g.items, "paymentMode"),
      createdAt: created,
    }
  })

  bills.sort((a, b) =>
    a.date !== b.date
      ? a.date.localeCompare(b.date)
      : a.createdAt.localeCompare(b.createdAt) || a.key.localeCompare(b.key)
  )
  bills.forEach((b, i) => { b.billNumber = i + 1 })

  attachPayments(bills, payments)

  bills.forEach(b => {
    b.balance = b.paid === null ? null : Math.max(0, round2(b.totalAmount - b.paid))
  })

  return bills
}

// Works out how much was paid on each bill.
// 1) paidAmount saved on the purchase rows, 2) payments tagged "[bill:KEY]" in the note,
// 3) older payments matched by supplier + "Paid on Bill (DATE)" + the bill total.
function attachPayments(bills: Bill[], payments: SupplierPaymentRecord[] | null) {
  const storedPaid = new Map<string, boolean>()
  bills.forEach(b => { if (b.paid !== null) storedPaid.set(b.key, true) })

  if (payments === null) return // payment data not available -> stays null

  const pays = payments.map((p, i) => ({
    i,
    supplierId: String(p.supplierId ?? ""),
    amount: Number(p.amount) || 0,
    note: String(p.note ?? ""),
  }))
  const used = new Set<number>()

  // tagged payments
  bills.forEach(b => {
    if (storedPaid.has(b.key)) return
    const tag = `[bill:${b.key}]`
    const tagged = pays.filter(p => p.note.includes(tag))
    if (tagged.length > 0) {
      b.paid = round2(tagged.reduce((a, p) => a + p.amount, 0))
      tagged.forEach(p => used.add(p.i))
    }
  })

  // older, untagged payments
  const pending = bills.filter(b => b.paid === null)
  const groupsMap = new Map<string, Bill[]>()
  pending.forEach(b => {
    const k = `${b.supplierId}__${b.date}`
    const list = groupsMap.get(k) ?? []
    list.push(b)
    groupsMap.set(k, list)
  })

  groupsMap.forEach(group => {
    const first = group[0]
    const candidates = () =>
      pays.filter(
        p =>
          !used.has(p.i) &&
          p.supplierId === first.supplierId &&
          p.note.includes(`Paid on Bill (${first.date})`)
      )

    if (group.length === 1) {
      const c = candidates()
      group[0].paid = round2(c.reduce((a, p) => a + p.amount, 0))
      c.forEach(p => used.add(p.i))
      return
    }

    const ambiguous: Bill[] = []
    group.forEach(b => {
      const variants = Array.from(
        new Set([
          b.totalAmount.toLocaleString(),
          b.totalAmount.toLocaleString("en-IN"),
          b.totalAmount.toLocaleString("en-US"),
        ])
      )
      const matches = candidates().filter(p => variants.some(v => p.note.includes(`Total: ₹${v}`)))
      if (matches.length > 0) {
        b.paid = round2(matches.reduce((a, p) => a + p.amount, 0))
        matches.forEach(p => used.add(p.i))
      } else {
        ambiguous.push(b)
      }
    })
    if (ambiguous.length > 0) {
      const left = candidates()
      ambiguous.forEach(b => { b.paid = left.length > 0 ? null : 0 })
    }
  })

  // bills with no entry at all -> nothing was paid
  bills.forEach(b => {
    if (b.paid === null && !pending.includes(b)) b.paid = 0
  })
}
