// lib/invoice-types.ts
// Shared types for the invoice scanner, the AI route result and the offline OCR parser.

export interface ScannedItem {
  serialNumber?: string | number | null
  name: string
  itemCode?: string | null
  hsnCode?: string | null
  quantity: number
  purchasePrice: number            // cost per piece AFTER discount, BEFORE GST
  taxRate?: number | null
  taxAmount?: number | null
  sellingPrice?: number | null     // kept for old API responses
  category: string
  mrp?: number | null              // printed MRP column on the bill
  taxableAmount?: number | null    // line "Taxable Amount" (after discount, before GST)
  discountPercent?: number | null  // line discount %
}

export interface ScanResult {
  items: ScannedItem[]
  supplierName: string | null
  supplierGst?: string | null
  supplierPhone?: string | null
  supplierEmail?: string | null
  supplierAddress?: string | null
  supplierContactPerson?: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  totalAmount: number | null
  source?: "ai" | "ocr"
  needsReview?: boolean
}
