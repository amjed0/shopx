"use client"

import * as React from "react"
import { 
  Plus, 
  Search, 
  Box, 
  AlertCircle, 
  Package, 
  Tag, 
  X,
  PlusCircle,
  Edit2,
  RefreshCw,
  MoreVertical,
  Pencil,
  Loader2,
  Trash2,
  FileText,
  StickyNote,
  Download,
  FileSpreadsheet,
  Boxes,
  IndianRupee,
  Layers,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Printer,
  ExternalLink,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useUser } from "@/app/auth/use-user"
import { useSocket } from "@/hooks/useSocket"
import { useShop } from "@/hooks/useShop"
import { ProductNotesDialog } from "@/components/inventory/product-notes-dialog"

export interface ProductNote {
  id: string;
  title: string;
  content: string;
  category?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  supplierId?: string;
  supplierName?: string;
  notes?: ProductNote[];
  remarks?: string;
}

export default function InventoryPage() {
  const { user } = useUser()
  const { data: shopData, isVehicleDealer } = useShop(user?.uid)
  const companyName = shopData?.companyName?.trim() || shopData?.ownerName?.trim() || "ShopX"
  const companyContact = [shopData?.location, shopData?.phone].filter(Boolean).join(" • ")

  // ── PRODUCTS STATE (from MongoDB API) ──
  const [products, setProducts] = React.useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = React.useState(true)

  const fetchProducts = React.useCallback(async () => {
    if (!user?.uid) return
    try {
      setLoadingProducts(true)
      const res = await fetch("/api/products", {
        headers: { "x-user-id": user.uid },
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to fetch products")
      const data: Product[] = await res.json()
      setProducts(data)
    } catch (err) {
      console.error("Failed to load products", err)
      toast({ variant: "destructive", title: "Error", description: "Could not load products." })
    } finally {
      setLoadingProducts(false)
    }
  }, [user?.uid])

  React.useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useSocket((data) => {
    if (!user?.uid) return
    console.log("Socket inventory update received:", data)
    if (data.action === "update" && data.product) {
      setProducts(prev => prev.map(p => p.id === data.product.id ? data.product : p))
    } else if (data.action === "delete" && data.productId) {
      setProducts(prev => prev.filter(p => p.id !== data.productId))
    } else if (data.action === "create" && data.product) {
      setProducts(prev => {
        if (prev.some(p => p.id === data.product.id)) return prev
        return [...prev, data.product].sort((a, b) => a.name.localeCompare(b.name))
      })
    }
  })




  const [showOnlyLowStock, setShowOnlyLowStock] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [openCategories, setOpenCategories] = React.useState<string[]>([])
  
  // View Layout: "categories" (accordion, closed by default) | "all" (flat table view of all products)
  const [viewLayout, setViewLayout] = React.useState<"categories" | "all">("categories")

  // All Products Directory Modal State
  const [isAllProductsModalOpen, setIsAllProductsModalOpen] = React.useState(false)
  const [modalSearch, setModalSearch] = React.useState("")
  const [modalCategoryFilter, setModalCategoryFilter] = React.useState("ALL")
  const [modalSupplierFilter, setModalSupplierFilter] = React.useState("ALL")
  const [modalSortBy, setModalSortBy] = React.useState<"name" | "stock" | "stockValue" | "sellingPrice">("name")
  const [modalSortOrder, setModalSortOrder] = React.useState<"asc" | "desc">("asc")

  // Export Dialog State
  const [isExportDialogOpen, setIsExportDialogOpen] = React.useState(false)
  const [exportCategoryFilter, setExportCategoryFilter] = React.useState<string>("ALL")

  // Google Sheets Guide Dialog State
  const [isGoogleSheetsGuideOpen, setIsGoogleSheetsGuideOpen] = React.useState(false)
  const [copiedForSheets, setCopiedForSheets] = React.useState(false)
  const [sheetsExportFilename, setSheetsExportFilename] = React.useState("")

  // Add Product Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isNewCategoryMode, setIsNewCategoryMode] = React.useState(false)
  const [selectedCategory, setSelectedCategory] = React.useState("")
  const [newCategoryNameInput, setNewCategoryNameInput] = React.useState("")
  const [searchInAdd, setSearchInAdd] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  
  const generateSKU = () => `SX-${Math.floor(1000 + Math.random() * 9000)}`

  // Form State for "Add Product"
  const [formData, setFormData] = React.useState({
    name: "",
    sku: "",
    purchasePrice: "",
    sellingPrice: "",
    stock: "",
    minStock: ""
  })

  // Edit Product Dialog State
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [productToEdit, setProductToEdit] = React.useState<Product | null>(null)
  const [editCategoryMode, setEditCategoryMode] = React.useState(false)
  const [editSelectedCategory, setEditSelectedCategory] = React.useState("")
  const [editNewCategoryInput, setEditNewCategoryInput] = React.useState("")
  const [isEditSubmitting, setIsEditSubmitting] = React.useState(false)
  const [editSelectedSupplier, setEditSelectedSupplier] = React.useState("")

  // Category Rename State
  const [isRenameDialogOpen, setIsRenameDialogOpen] = React.useState(false)
  const [categoryToRename, setCategoryToRename] = React.useState("")
  const [newCategoryName, setNewCategoryName] = React.useState("")

  // Product Notes Dialog State
  const [isNotesDialogOpen, setIsNotesDialogOpen] = React.useState(false)
  const [productForNotes, setProductForNotes] = React.useState<Product | null>(null)

  const handleOpenNotes = (product: Product) => {
    setProductForNotes(product)
    setIsNotesDialogOpen(true)
  }

  const handleProductUpdatedFromNotes = (updatedProduct: Product) => {
    setProductForNotes(updatedProduct)
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p))
  }

  // ── SUPPLIER STATES ──
  const [suppliers, setSuppliers] = React.useState<{ id: string; name: string }[]>([])
  const [selectedSupplier, setSelectedSupplier] = React.useState("")

  // ── FETCH SUPPLIERS FROM API ──
  React.useEffect(() => {
    if (!user?.uid) return
    fetch("/api/suppliers", {
      headers: { "x-user-id": user.uid },
      credentials: "include",
    })
      .then(res => res.ok ? res.json() : [])
      .then((data: { id: string; name: string }[]) => {
        setSuppliers(data)
      })
      .catch(err => console.error("Failed to load suppliers", err))
  }, [user?.uid])

  // Group products by category
  const categories = React.useMemo(() => 
    Array.from(new Set(products.map(p => p.category))).sort(),
  [products])

  // Stock totals & valuation metrics
  const totalStockQty = React.useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0)
  }, [products])

  const totalCostValue = React.useMemo(() => {
    return products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.purchasePrice) || 0)), 0)
  }, [products])

  const totalRetailValue = React.useMemo(() => {
    return products.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.sellingPrice) || 0)), 0)
  }, [products])

  // PDF & Export functions
  const buildPdfBlob = (
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    summary?: { label: string; value: string }[]
  ): Blob => {
    const pageWidth = 595.28
    const pageHeight = 841.89
    const margin = 36
    const contentWidth = pageWidth - margin * 2

    let stream = ""
    const esc = (txt: any) =>
      String(txt ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")

    stream += `BT /F2 16 Tf 0.05 0.1 0.2 rg ${margin} ${pageHeight - margin - 20} Td (${esc(title)}) Tj ET\n`
    stream += `BT /F1 9 Tf 0.4 0.45 0.5 rg ${margin} ${pageHeight - margin - 35} Td (${esc(subtitle)}) Tj ET\n`
    const dateStr = `Exported: ${new Date().toLocaleDateString()}`
    stream += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${pageWidth - margin - 100} ${pageHeight - margin - 20} Td (${esc(dateStr)}) Tj ET\n`

    const headerLineY = pageHeight - margin - 45
    stream += `0.0 0.5 0.8 RG 1.5 w ${margin} ${headerLineY} m ${pageWidth - margin} ${headerLineY} l S\n`

    const colCount = Math.max(1, headers.length)
    const colWidth = contentWidth / colCount

    let currentY = headerLineY - 18
    stream += `0.94 0.96 0.98 rg ${margin} ${currentY - 4} ${contentWidth} 18 re f\n`
    stream += `0.8 0.85 0.9 RG 0.5 w ${margin} ${currentY - 4} ${contentWidth} 18 re s\n`

    headers.forEach((h, idx) => {
      const x = margin + idx * colWidth + 5
      stream += `BT /F2 8.5 Tf 0.1 0.15 0.2 rg ${x} ${currentY + 1} Td (${esc(h)}) Tj ET\n`
    })

    currentY -= 18

    rows.forEach((row, rowIdx) => {
      if (currentY < margin + 40) return
      if (rowIdx % 2 === 1) {
        stream += `0.98 0.98 0.99 rg ${margin} ${currentY - 4} ${contentWidth} 16 re f\n`
      }
      stream += `0.9 0.92 0.94 RG 0.5 w ${margin} ${currentY - 4} ${contentWidth} 16 re s\n`

      row.forEach((cell, idx) => {
        const x = margin + idx * colWidth + 5
        const cellText = String(cell ?? "").replace(/₹/g, "Rs. ")
        stream += `BT /F1 8 Tf 0.2 0.2 0.2 rg ${x} ${currentY} Td (${esc(cellText)}) Tj ET\n`
      })

      currentY -= 16
    })

    if (summary && summary.length > 0) {
      currentY -= 12
      stream += `0.0 0.5 0.8 RG 1 w ${margin} ${currentY + 10} m ${pageWidth - margin} ${currentY + 10} l S\n`
      summary.forEach((s) => {
        const sumText = `${s.label}: ${String(s.value).replace(/₹/g, "Rs. ")}`
        stream += `BT /F2 9 Tf 0.05 0.3 0.6 rg ${margin + 10} ${currentY} Td (${esc(sumText)}) Tj ET\n`
        currentY -= 14
      })
    }

    stream += `BT /F1 8 Tf 0.6 0.6 0.6 rg ${margin} 25 Td (${esc(companyName)} — Inventory Valuation Report) Tj ET\n`

    const objects: string[] = []
    objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)
    objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`)
    objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`)

    const enc = new TextEncoder()
    const streamBytes = enc.encode(stream)
    objects.push(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`)
    objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)
    objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`)

    const header = "%PDF-1.4\n"
    let body = ""
    const xref: string[] = ["xref\n0 7\n0000000000 65535 f \n"]

    let currentOffset = enc.encode(header).length

    for (let i = 0; i < objects.length; i++) {
      const offsetStr = String(currentOffset).padStart(10, "0")
      xref.push(`${offsetStr} 00000 n \n`)
      body += objects[i]
      currentOffset += enc.encode(objects[i]).length
    }

    const startxref = currentOffset
    const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`

    const fullPdfStr = header + body + xref.join("") + trailer
    return new Blob([enc.encode(fullPdfStr)], { type: "application/pdf" })
  }

  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\r\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${filename}.csv`)
    document.body.appendChild(link)
    link.click()

    // Delay revoke so browser download manager has time to read the blob
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link)
      }
      URL.revokeObjectURL(url)
    }, 2000)

    toast({ title: "Excel / CSV Exported ✓", description: `Downloaded ${filename}.csv` })
  }

  const exportToGoogleSheets = (filename: string, headers: string[], rows: (string | number)[][]) => {
    // 1. Download CSV file cleanly
    exportToCSV(filename, headers, rows)

    // 2. Copy TSV data to clipboard for instant 1-click Ctrl+V paste into Google Sheets
    try {
      const tsvContent = [
        headers.join("\t"),
        ...rows.map(r => r.map(c => String(c ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
      ].join("\r\n")

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(tsvContent).then(() => {
          toast({
            title: "Data Copied for Google Sheets ✓",
            description: "CSV downloaded & data copied to clipboard! In your Google Sheet, press Ctrl + V in cell A1 to paste everything.",
          })
        }).catch(() => {
          toast({
            title: "Google Sheets Export ✓",
            description: "Downloaded CSV file. In Google Sheets, click File -> Import -> Upload.",
          })
        })
      }
    } catch (err) {
      console.warn("Clipboard copy failed:", err)
      toast({
        title: "Google Sheets Export ✓",
        description: "Downloaded CSV file. In Google Sheets, click File -> Import -> Upload.",
      })
    }
  }

  const exportToPDF = async (
    title: string,
    subtitle: string,
    headers: string[],
    rows: (string | number)[][],
    summary?: { label: string; value: string }[],
    filename?: string
  ) => {
    const safeFilename = filename || `Inventory_${new Date().toISOString().split("T")[0]}`

    try {
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const s1 = document.createElement("script")
          s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          s1.onload = () => {
            const s2 = document.createElement("script")
            s2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
            s2.onload = resolve
            s2.onerror = reject
            document.head.appendChild(s2)
          }
          s1.onerror = reject
          document.head.appendChild(s1)
        })
      }

      if ((window as any).jspdf?.jsPDF) {
        const { jsPDF } = (window as any).jspdf
        const doc = new jsPDF("landscape")
        doc.setFontSize(16)
        doc.setTextColor(15, 23, 42)
        doc.text(title, 14, 18)
        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139)
        doc.text(subtitle, 14, 25)

        const sanitizedHeaders = headers.map(h => String(h).replace(/₹/g, "INR"))
        const sanitizedRows = rows.map(r => r.map(c => String(c ?? "").replace(/₹/g, "Rs. ")))

        ;(doc as any).autoTable({
          startY: 30,
          head: [sanitizedHeaders],
          body: sanitizedRows,
          theme: "striped",
          headStyles: { fillColor: [15, 118, 110] },
          styles: { fontSize: 8 },
        })

        if (summary && summary.length > 0) {
          const finalY = (doc as any).lastAutoTable.finalY + 8
          summary.forEach((s, idx) => {
            doc.setFontSize(9)
            doc.setTextColor(30, 41, 59)
            doc.text(`${s.label}: ${String(s.value).replace(/₹/g, "Rs. ")}`, 14, finalY + (idx * 5.5))
          })
        }

        doc.save(`${safeFilename}.pdf`)
        toast({ title: "PDF Downloaded ✓", description: `Saved ${safeFilename}.pdf to Downloads.` })
        return
      }
    } catch (cdnErr) {
      console.warn("CDN PDF unavailable, using native generator fallback:", cdnErr)
    }

    const blob = buildPdfBlob(title, subtitle, headers, rows, summary)
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `${safeFilename}.pdf`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: "PDF Downloaded ✓", description: `Saved ${safeFilename}.pdf to Downloads.` })
  }

  const getExportData = React.useCallback((specificCategory?: string) => {
    const catToUse = specificCategory !== undefined ? specificCategory : exportCategoryFilter
    const targetProducts = catToUse === "ALL" 
      ? products 
      : products.filter(p => p.category === catToUse)

    const headers = [
      "#",
      "Product Name",
      "SKU",
      "Category",
      "Supplier",
      "Stock Qty",
      "Min Alert Qty",
      "Purchase Cost (Rs.)",
      "Selling Price (Rs.)",
      "Stock Cost Value (Rs.)",
      "Stock Retail Value (Rs.)",
      "Status",
    ]

    const rows = targetProducts.map((p, idx) => {
      const stock = Number(p.stock) || 0
      const cost = Number(p.purchasePrice) || 0
      const retail = Number(p.sellingPrice) || 0
      const costValue = stock * cost
      const retailValue = stock * retail
      const status = stock <= 0 ? "Out of Stock" : stock <= p.minStock ? "Low Stock" : "In Stock"

      return [
        idx + 1,
        p.name,
        p.sku,
        p.category,
        p.supplierName || "—",
        stock,
        p.minStock,
        cost.toFixed(2),
        retail.toFixed(2),
        costValue.toFixed(2),
        retailValue.toFixed(2),
        status,
      ]
    })

    const totalQty = targetProducts.reduce((acc, p) => acc + (Number(p.stock) || 0), 0)
    const totalCost = targetProducts.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.purchasePrice) || 0)), 0)
    const totalRetail = targetProducts.reduce((acc, p) => acc + ((Number(p.stock) || 0) * (Number(p.sellingPrice) || 0)), 0)

    const summary = [
      { label: "Total Products", value: `${targetProducts.length} items` },
      { label: "Total Units on Hand", value: `${totalQty} units` },
      { label: "Total Stock Cost Value", value: `Rs. ${totalCost.toLocaleString("en-IN")}` },
      { label: "Total Retail Value", value: `Rs. ${totalRetail.toLocaleString("en-IN")}` },
    ]

    return { headers, rows, summary, count: targetProducts.length }
  }, [products, exportCategoryFilter])

  const handleExportCSV = (cat?: string) => {
    const { headers, rows } = getExportData(cat)
    const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeCompany}_Inventory_Report_${new Date().toISOString().split("T")[0]}`
    exportToCSV(filename, headers, rows)
  }

  const copyTableDataToClipboard = (cat?: string) => {
    const { headers, rows } = getExportData(cat || exportCategoryFilter)
    const tsvContent = [
      headers.join("\t"),
      ...rows.map(r => r.map(c => String(c ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
    ].join("\r\n")

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(tsvContent).then(() => {
        setCopiedForSheets(true)
        setTimeout(() => setCopiedForSheets(false), 3000)
        toast({ title: "Copied! ✓", description: "Table data copied. Now press Ctrl + V in cell A1 of Google Sheets." })
      }).catch((err) => {
        console.warn("Clipboard copy failed:", err)
      })
    }
  }

  const handleExportGoogleSheets = (cat?: string) => {
    const { headers, rows } = getExportData(cat)
    const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeCompany}_Inventory_Report_${new Date().toISOString().split("T")[0]}`
    setSheetsExportFilename(filename)
    exportToGoogleSheets(filename, headers, rows)
    copyTableDataToClipboard(cat)
    setIsGoogleSheetsGuideOpen(true)
  }

  const handleExportPDF = (cat?: string) => {
    const { headers, rows, summary, count } = getExportData(cat)
    const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    const usedCat = cat || exportCategoryFilter
    const title = `${companyName} — Inventory & Stock Valuation`
    const subParts = [
      companyContact,
      `Category: ${usedCat}`,
      `Total ${count} Product(s)`,
      `Date: ${dateStr}`
    ].filter(Boolean)
    const subtitle = subParts.join(" | ")
    const safeCompany = companyName.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeCompany}_Inventory_${new Date().toISOString().split("T")[0]}`
    exportToPDF(title, subtitle, headers, rows, summary, filename)
  }

  // Modal filtered products
  const modalFilteredProducts = React.useMemo(() => {
    return products
      .filter(p => {
        const matchesSearch = 
          p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
          p.sku.toLowerCase().includes(modalSearch.toLowerCase()) ||
          p.category.toLowerCase().includes(modalSearch.toLowerCase()) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(modalSearch.toLowerCase()))
        const matchesCategory = modalCategoryFilter === "ALL" || p.category === modalCategoryFilter
        const matchesSupplier = modalSupplierFilter === "ALL" || p.supplierId === modalSupplierFilter
        return matchesSearch && matchesCategory && matchesSupplier
      })
      .sort((a, b) => {
        let diff = 0
        if (modalSortBy === "name") {
          diff = a.name.localeCompare(b.name)
        } else if (modalSortBy === "stock") {
          diff = (a.stock || 0) - (b.stock || 0)
        } else if (modalSortBy === "stockValue") {
          diff = ((a.stock || 0) * (a.purchasePrice || 0)) - ((b.stock || 0) * (b.purchasePrice || 0))
        } else if (modalSortBy === "sellingPrice") {
          diff = (a.sellingPrice || 0) - (b.sellingPrice || 0)
        }
        return modalSortOrder === "asc" ? diff : -diff
      })
  }, [products, modalSearch, modalCategoryFilter, modalSupplierFilter, modalSortBy, modalSortOrder])
  
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLowStock = showOnlyLowStock ? p.stock <= p.minStock : true;
    return matchesSearch && matchesLowStock;
  })

  const groupedProducts = React.useMemo(() => {
    return categories.reduce((acc, category) => {
      const categoryProducts = filteredProducts.filter(p => p.category === category)
      if (categoryProducts.length > 0) {
        acc[category] = categoryProducts
      }
      return acc
    }, {} as Record<string, Product[]>)
  }, [categories, filteredProducts])

  // Keep category accordions closed by default; auto-expand matching categories only during search
  React.useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setOpenCategories(Object.keys(groupedProducts))
    }
  }, [searchQuery, groupedProducts])

  const suggestionsInAdd = React.useMemo(() => {
    if (searchInAdd.length < 2) return []
    return products.filter(p => 
      p.name.toLowerCase().includes(searchInAdd.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchInAdd.toLowerCase())
    ).slice(0, 3)
  }, [searchInAdd, products])

  const resetAddForm = () => {
    setFormData({ 
      name: "", 
      sku: generateSKU(), 
      purchasePrice: "", 
      sellingPrice: "", 
      stock: "", 
      minStock: "" 
    })
    setNewCategoryNameInput("")
    setSelectedCategory("")
    setIsNewCategoryMode(false)
    setSearchInAdd("")
    setSelectedSupplier("")
  }

  // ── ADD PRODUCT via MongoDB API ──
  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user?.uid) return

    const category = isNewCategoryMode ? newCategoryNameInput : selectedCategory
    
    if (!category) {
      toast({ variant: "destructive", title: "Missing Category", description: "Please select an existing category or create a new one." })
      return
    }

    const productData = {
      name: formData.name,
      sku: formData.sku || generateSKU(),
      category: category,
      purchasePrice: Number(formData.purchasePrice),
      sellingPrice: Number(formData.sellingPrice),
      stock: Number(formData.stock),
      minStock: Number(formData.minStock),
      supplierId: selectedSupplier || "",
      supplierName: suppliers.find(s => s.id === selectedSupplier)?.name ?? "",
    }

    try {
      setIsSubmitting(true)
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        credentials: "include",
        body: JSON.stringify(productData),
      })
      if (!res.ok) throw new Error("Failed to add product")
      const newProduct = await res.json()
      setProducts(prev => [...prev, newProduct].sort((a, b) => a.name.localeCompare(b.name)))
      setIsAddDialogOpen(false)
      resetAddForm()
      toast({ title: "Product Initialized", description: `${productData.name} has been added to inventory.` })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not add product." })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── DELETE PRODUCT via MongoDB API ──
  const handleDeleteProduct = async (productId: string) => {
    if (!user?.uid) return
    if (!confirm("Are you sure you want to delete this product? This action cannot be undone.")) return

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user.uid,
        },
        credentials: "include",
      })
      if (!res.ok) throw new Error("Failed to delete product")
      
      setProducts(prev => prev.filter(p => p.id !== productId))
      toast({ title: "Product Deleted", description: "Product has been successfully removed." })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not delete product." })
    }
  }

  // ── EDIT PRODUCT via MongoDB API ──
  const handleEditProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!productToEdit || !user?.uid) return

    const formDataEdit = new FormData(e.currentTarget)
    const category = editCategoryMode ? editNewCategoryInput : editSelectedCategory

    if (!category) {
      toast({ variant: "destructive", title: "Error", description: "Category is required." })
      return
    }

    const updatedData = {
      name: formDataEdit.get("name") as string,
      sku: formDataEdit.get("sku") as string,
      category: category,
      purchasePrice: Number(formDataEdit.get("purchasePrice")),
      sellingPrice: Number(formDataEdit.get("sellingPrice")),
      stock: Number(formDataEdit.get("stock")),
      minStock: Number(formDataEdit.get("minStock")),
      supplierId: editSelectedSupplier || "",
      supplierName: suppliers.find(s => s.id === editSelectedSupplier)?.name ?? "",
    }

    try {
      setIsEditSubmitting(true)
      const res = await fetch(`/api/products/${productToEdit.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.uid,
        },
        credentials: "include",
        body: JSON.stringify(updatedData),
      })
      if (!res.ok) throw new Error("Failed to update product")
      const updated = await res.json()
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
      setIsEditDialogOpen(false)
      toast({ title: "Product Updated", description: "Changes saved successfully." })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not update product." })
    } finally {
      setIsEditSubmitting(false)
    }
  }

  // ── RENAME CATEGORY via MongoDB API (batch update) ──
  const handleRenameCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!categoryToRename || !newCategoryName || !user?.uid) return

    const toUpdate = products.filter(p => p.category === categoryToRename)

    try {
      await Promise.all(toUpdate.map(p =>
        fetch(`/api/products/${p.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.uid,
          },
          credentials: "include",
          body: JSON.stringify({ category: newCategoryName }),
        })
      ))
      setProducts(prev => prev.map(p => 
        p.category === categoryToRename ? { ...p, category: newCategoryName } : p
      ))
      setIsRenameDialogOpen(false)
      setNewCategoryName("")
      toast({ title: "Category Renamed", description: `Updated ${toUpdate.length} product(s) to "${newCategoryName}".` })
    } catch (err) {
      console.error(err)
      toast({ variant: "destructive", title: "Error", description: "Could not rename category." })
    }
  }

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length

  return (
    <div className="space-y-4 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-headline font-bold text-foreground">Inventory Vault</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Manage products and track real-time stock levels.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if(open) {
              resetAddForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary rounded-full px-6">
                <Plus className="w-4 h-4 mr-2" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleAddProduct}>
                <DialogHeader><DialogTitle>New Product Entry</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-6">
                  {/* Quick Select */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Quick Select Existing</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input 
                        placeholder="Search for common items..." 
                        value={searchInAdd} 
                        onChange={e => setSearchInAdd(e.target.value)}
                        className="pl-8 h-9 text-xs"
                      />
                    </div>
                    {suggestionsInAdd.length > 0 && (
                      <div className="bg-muted/50 rounded-lg p-1 space-y-1">
                        {suggestionsInAdd.map(p => (
                          <button key={p.id} type="button" onClick={() => {
                            setFormData({
                              name: p.name, 
                              sku: generateSKU(),
                              purchasePrice: p.purchasePrice.toString(),
                              sellingPrice: p.sellingPrice.toString(), 
                              stock: "",
                              minStock: p.minStock.toString()
                            })
                            setSelectedCategory(p.category)
                            setIsNewCategoryMode(false)
                            setSearchInAdd("")
                          }} className="block w-full text-left p-2 hover:bg-secondary rounded text-xs transition-colors flex items-center justify-between">
                            <span>{p.name}</span>
                            <span className="text-[9px] font-bold uppercase opacity-50">{p.category}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                    <Label className="sm:text-right text-xs font-semibold">Name</Label>
                    <Input className="sm:col-span-3" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                  </div>

                  {/* SKU */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                    <Label className="sm:text-right text-xs font-semibold">SKU</Label>
                    <div className="sm:col-span-3 flex gap-2">
                      <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} required />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setFormData({...formData, sku: generateSKU()})}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                    <Label className="sm:text-right text-xs font-semibold">Category</Label>
                    <div className="sm:col-span-3 flex gap-2">
                      {isNewCategoryMode ? (
                        <Input 
                          placeholder="Type new category..." 
                          value={newCategoryNameInput}
                          onChange={(e) => setNewCategoryNameInput(e.target.value)}
                          autoFocus 
                          required={isNewCategoryMode}
                        />
                      ) : (
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setIsNewCategoryMode(!isNewCategoryMode);
                          if (!isNewCategoryMode) setSelectedCategory("");
                          else setNewCategoryNameInput("");
                        }}
                        className={cn(isNewCategoryMode && "text-destructive hover:text-destructive hover:bg-destructive/10")}
                        title={isNewCategoryMode ? "Cancel new category" : "Add new category"}
                      >
                        {isNewCategoryMode ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                    <Label className="sm:text-right text-xs font-semibold">Supplier</Label>
                    <div className="sm:col-span-3">
                      <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Prices */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Purchase ₹</Label>
                      <Input type="number" placeholder="Cost" value={formData.purchasePrice} onChange={e => setFormData({...formData, purchasePrice: e.target.value})} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Selling ₹</Label>
                      <Input type="number" placeholder="Price" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: e.target.value})} required />
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Stock Qty</Label>
                      <Input type="number" placeholder="Stock" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} required />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Alert Level</Label>
                      <Input type="number" placeholder="Min" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} required />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Initialize Product
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* All Products Modal Trigger Button */}
          <Button 
            onClick={() => setIsAllProductsModalOpen(true)}
            variant="outline"
            className="rounded-full px-4 border-primary/30 text-primary hover:bg-primary/10 font-bold text-xs gap-1.5 shadow-sm"
          >
            <Boxes className="w-4 h-4 text-primary" />
            <span>All Products</span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 rounded-full bg-primary/10 text-primary font-bold">
              {products.length}
            </Badge>
          </Button>

          {/* Export Button & Dialog */}
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                className="rounded-full px-4 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-bold text-xs gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span>Export</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Download className="w-4 h-4 text-emerald-500" /> Export Inventory & Stock Valuation
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Export product directory, stock quantities, purchase costs, and stock valuation to Excel, Google Sheets, or PDF.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Category Scope</Label>
                  <Select value={exportCategoryFilter} onValueChange={setExportCategoryFilter}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories ({products.length} Products)</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat} ({products.filter(p => p.category === cat).length} items)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl space-y-2 border border-border/50 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Products in scope:</span>
                    <span className="font-bold text-foreground">
                      {exportCategoryFilter === "ALL" ? products.length : products.filter(p => p.category === exportCategoryFilter).length} SKUs
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Stock Qty:</span>
                    <span className="font-bold text-foreground">
                      {(exportCategoryFilter === "ALL" ? products : products.filter(p => p.category === exportCategoryFilter)).reduce((acc, p) => acc + (p.stock || 0), 0)} Units
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Stock Cost Valuation:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{(exportCategoryFilter === "ALL" ? products : products.filter(p => p.category === exportCategoryFilter)).reduce((acc, p) => acc + ((p.stock || 0) * (p.purchasePrice || 0)), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Retail Valuation:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      ₹{(exportCategoryFilter === "ALL" ? products : products.filter(p => p.category === exportCategoryFilter)).reduce((acc, p) => acc + ((p.stock || 0) * (p.sellingPrice || 0)), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <Button 
                    onClick={() => { handleExportCSV(); setIsExportDialogOpen(false); }}
                    className="flex flex-col items-center justify-center h-20 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span className="font-bold text-xs">Excel (.csv)</span>
                  </Button>

                  <a 
                    href="https://sheets.new"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { 
                      handleExportGoogleSheets(); 
                      setIsExportDialogOpen(false); 
                    }}
                    className="flex flex-col items-center justify-center h-20 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm text-center cursor-pointer transition-all"
                  >
                    <Boxes className="w-5 h-5" />
                    <span className="font-bold text-xs">Google Sheets</span>
                  </a>

                  <Button 
                    onClick={() => { handleExportPDF(); setIsExportDialogOpen(false); }}
                    className="flex flex-col items-center justify-center h-20 gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm"
                  >
                    <FileText className="w-5 h-5" />
                    <span className="font-bold text-xs">PDF Document</span>
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Google Sheets Assistant Dialog */}
          <Dialog open={isGoogleSheetsGuideOpen} onOpenChange={setIsGoogleSheetsGuideOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Boxes className="w-5 h-5 text-blue-500" />
                  <span>How to View in Google Sheets</span>
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Google Sheets always opens with an empty blank grid. Follow either of the 2 easy methods below to populate it with your data:
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                {/* Download Status */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Spreadsheet file downloaded to Downloads</span>
                  </div>
                  <span className="font-mono text-[10px] opacity-75">{sheetsExportFilename}.csv</span>
                </div>

                {/* Method 1: Instant Paste (Fastest) */}
                <div className="p-3.5 bg-muted/40 border border-border/50 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[10px] uppercase font-bold">Fastest</Badge>
                      <span className="text-xs font-bold text-foreground">Method 1: Instant Paste (Ctrl + V)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyTableDataToClipboard()}
                      className="text-xs font-bold gap-1.5 h-9 rounded-lg border-border shadow-sm hover:bg-secondary/70"
                    >
                      <Copy className="w-3.5 h-3.5 text-primary" />
                      <span>{copiedForSheets ? "✓ Copied!" : "1. Copy Table Data"}</span>
                    </Button>

                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-all text-center"
                    >
                      <span>2. Open Google Sheets</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    👉 Once Google Sheets opens, simply click cell <strong>A1</strong> and press <kbd className="px-1.5 py-0.5 text-[10px] bg-secondary rounded border border-border font-mono font-bold text-foreground">Ctrl + V</kbd> (or Cmd + V). All rows and columns will paste instantly!
                  </p>
                </div>

                {/* Method 2: Import File */}
                <div className="p-3 bg-secondary/30 border border-border/40 rounded-xl space-y-1 text-xs">
                  <span className="font-bold text-foreground">Method 2: Import Downloaded File</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    In the Google Sheets top menu: Click <strong>File</strong> → <strong>Import</strong> → <strong>Upload</strong> tab, then select the downloaded file <strong>{sheetsExportFilename}.csv</strong>.
                  </p>
                </div>
              </div>

              <DialogFooter className="flex flex-row justify-between items-center sm:justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Tip: Excel (.csv) opens directly in Microsoft Excel.
                </span>
                <Button size="sm" onClick={() => setIsGoogleSheetsGuideOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 flex items-center gap-3 sm:gap-4 border-none bg-card shadow-sm">
          <div className="p-2.5 sm:p-3 bg-primary/10 rounded-xl shrink-0">
            <Box className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider truncate">Total Products</p>
            <p className="text-xl sm:text-2xl font-bold">{products.length}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 sm:gap-4 border-none bg-card shadow-sm">
          <div className="p-2.5 sm:p-3 bg-blue-500/10 rounded-xl shrink-0">
            <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider truncate">Total Stock Qty</p>
            <p className="text-xl sm:text-2xl font-bold">{totalStockQty} <span className="text-xs font-normal text-muted-foreground">Units</span></p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 sm:gap-4 border-none bg-card shadow-sm">
          <div className="p-2.5 sm:p-3 bg-emerald-500/10 rounded-xl shrink-0">
            <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider truncate">Stock Valuation</p>
            <p className="text-xl sm:text-2xl font-bold">₹{totalCostValue.toLocaleString("en-IN")}</p>
          </div>
        </Card>

        <Card 
          onClick={() => setShowOnlyLowStock(!showOnlyLowStock)} 
          className={cn(
            "p-4 flex items-center gap-3 sm:gap-4 cursor-pointer transition-all border-none shadow-sm", 
            showOnlyLowStock ? "bg-destructive/10 ring-2 ring-destructive" : "bg-card hover:bg-muted/50"
          )}
        >
          <div className="p-2.5 sm:p-3 bg-destructive/10 rounded-xl shrink-0">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-wider truncate">Low Stock</p>
            <div className="flex items-center gap-2">
              <p className="text-xl sm:text-2xl font-bold">{lowStockCount}</p>
              {showOnlyLowStock && <Badge variant="destructive" className="text-[8px] h-4">FILTER ACTIVE</Badge>}
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-none bg-card shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <CardTitle className="font-headline text-lg sm:text-xl">Catalog</CardTitle>
            
            {/* View Mode Toggle: Categories vs All Products */}
            <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewLayout("categories")}
                className={cn(
                  "px-3 py-1 rounded-lg transition-all flex items-center gap-1.5",
                  viewLayout === "categories" 
                    ? "bg-background text-foreground shadow-sm font-bold" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Categories</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("all")}
                className={cn(
                  "px-3 py-1 rounded-lg transition-all flex items-center gap-1.5",
                  viewLayout === "all" 
                    ? "bg-primary text-primary-foreground shadow-sm font-bold" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>All Products</span>
                <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4 rounded-full">
                  {filteredProducts.length}
                </Badge>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search name or SKU..." className="w-full pl-9 rounded-full bg-secondary/30 border-none text-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            {showOnlyLowStock && (
              <Button variant="ghost" size="sm" onClick={() => setShowOnlyLowStock(false)} className="text-xs gap-1 h-8 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 shrink-0">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportDialogOpen(true)}
              className="text-xs gap-1.5 h-9 rounded-full px-3 border-border font-bold text-muted-foreground hover:text-foreground shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>Export</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          {loadingProducts ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
            </div>
          ) : viewLayout === "all" ? (
            /* Flat All Products Table View */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground">
                <p>Showing <span className="font-bold text-foreground">{filteredProducts.length}</span> product(s) across all categories</p>
                <div className="flex items-center gap-3">
                  <span>Total Qty: <strong className="text-foreground">{filteredProducts.reduce((acc, p) => acc + (p.stock || 0), 0)}</strong></span>
                  <span>Cost Value: <strong className="text-emerald-500">₹{filteredProducts.reduce((acc, p) => acc + ((p.stock || 0) * (p.purchasePrice || 0)), 0).toLocaleString("en-IN")}</strong></span>
                </div>
              </div>
              <div className="overflow-x-auto w-full rounded-xl border border-border/40">
                <Table className="min-w-[850px] sm:min-w-full">
                  <TableHeader className="bg-secondary/20">
                    <TableRow className="border-none hover:bg-transparent">
                      <TableHead className="font-bold uppercase text-[10px] w-12">#</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Product / SKU</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Category</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Supplier</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Stock Qty</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Purchase Cost</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Selling Price</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Total Stock Value</TableHead>
                      <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                      <TableHead className="text-right font-bold uppercase text-[10px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p, idx) => {
                      const costVal = (p.stock || 0) * (p.purchasePrice || 0)
                      const isLow = p.stock <= p.minStock
                      const isOut = p.stock <= 0
                      return (
                        <TableRow key={p.id} className="border-border/30 hover:bg-secondary/10">
                          <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-bold text-foreground">{p.name}</p>
                              <p className="text-[10px] uppercase font-mono text-muted-foreground">{p.sku}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] rounded-md font-semibold bg-secondary/30">
                              {p.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{p.supplierName || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className={cn("font-bold text-base", isOut ? "text-destructive" : isLow ? "text-amber-500" : "text-emerald-500")}>
                                {p.stock}
                              </span>
                              <span className="text-[10px] text-muted-foreground">/ min {p.minStock}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold">₹{p.purchasePrice}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-bold text-foreground">₹{p.sellingPrice}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                ₹{costVal.toLocaleString("en-IN")}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                Retail: ₹{((p.stock || 0) * (p.sellingPrice || 0)).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isOut ? (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase font-bold">Out of Stock</Badge>
                            ) : isLow ? (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase font-bold bg-amber-500 hover:bg-amber-600">Low Stock</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1">
                              {isVehicleDealer && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full hover:bg-amber-500/10 hover:text-amber-600 gap-1 text-xs text-muted-foreground h-8 px-2"
                                  onClick={() => handleOpenNotes(p)}
                                  title="View & Edit Notes"
                                >
                                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                                  {p.notes && p.notes.length > 0 && (
                                    <Badge variant="secondary" className="px-1 py-0 h-3.5 text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
                                      {p.notes.length}
                                    </Badge>
                                  )}
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="rounded-full hover:bg-primary/10 hover:text-primary h-8 px-2 text-xs"
                                onClick={() => { 
                                  setProductToEdit(p); 
                                  setEditSelectedCategory(p.category); 
                                  setEditSelectedSupplier(p.supplierId || "");
                                  setEditCategoryMode(false);
                                  setIsEditDialogOpen(true); 
                                }}
                              >
                                <Edit2 className="w-3 h-3 mr-1" /> Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="rounded-full hover:bg-destructive/10 hover:text-destructive h-8 px-2 text-xs"
                                onClick={() => handleDeleteProduct(p.id)}
                              >
                                <Trash2 className="w-3 h-3 mr-1" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredProducts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-2">
                  <Package className="w-10 h-10" />
                  <p className="font-medium text-xs">No products match your current search or filters.</p>
                </div>
              )}
            </div>
          ) : (
            <Accordion type="multiple" value={openCategories} onValueChange={setOpenCategories}>
              {Object.keys(groupedProducts).sort().map(category => (
                <AccordionItem key={category} value={category} className="border-border/50">
                  <div className="flex items-center justify-between pr-4 group">
                    <AccordionTrigger className="hover:no-underline flex-1 py-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Tag className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-bold text-base sm:text-lg truncate">{category}</span>
                        <Badge variant="secondary" className="rounded-md bg-secondary/50 text-[10px] shrink-0">{groupedProducts[category].length} Items</Badge>
                      </div>
                    </AccordionTrigger>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setCategoryToRename(category); setNewCategoryName(category); setIsRenameDialogOpen(true); }}>
                          <Pencil className="mr-2 h-4 w-4" /> Rename Category
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <AccordionContent className="pt-1 pb-3">
                    <div className="overflow-x-auto w-full">
                      <Table className="min-w-[620px] sm:min-w-full">
                        <TableHeader className="bg-secondary/20">
                        <TableRow className="border-none hover:bg-transparent">
                          <TableHead className="font-bold uppercase text-[10px]">Info</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Supplier</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Price</TableHead>
                          <TableHead className="font-bold uppercase text-[10px]">Stock Status</TableHead>
                          <TableHead className="text-right font-bold uppercase text-[10px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedProducts[category].map(p => (
                          <TableRow key={p.id} className="border-border/30 hover:bg-secondary/10">
                            <TableCell>
                              <div>
                                <p className="font-bold">{p.name}</p>
                                <p className="text-[10px] uppercase font-code opacity-60">{p.sku}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {p.supplierName ? (
                                <span className="text-xs font-medium text-muted-foreground">{p.supplierName}</span>
                              ) : (
                                <span className="text-[10px] opacity-30 italic">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold">₹{p.sellingPrice}</span>
                                <span className="text-[9px] text-muted-foreground">Buy: ₹{p.purchasePrice}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className={cn("font-bold text-lg", p.stock <= p.minStock ? 'text-destructive' : 'text-accent')}>
                                  {p.stock}
                                </span>
                                {p.stock <= p.minStock && (
                                  <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3 leading-none font-bold uppercase">Low</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                {isVehicleDealer && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="rounded-full hover:bg-amber-500/10 hover:text-amber-600 gap-1.5 text-xs text-muted-foreground"
                                    onClick={() => handleOpenNotes(p)}
                                    title="View & Edit Notes"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Notes</span>
                                    {p.notes && p.notes.length > 0 && (
                                      <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold">
                                        {p.notes.length}
                                      </Badge>
                                    )}
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full hover:bg-primary/10 hover:text-primary gap-1"
                                  onClick={() => { 
                                    setProductToEdit(p); 
                                    setEditSelectedCategory(p.category); 
                                    setEditSelectedSupplier(p.supplierId || "");
                                    setEditCategoryMode(false);
                                    setIsEditDialogOpen(true); 
                                  }}
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="rounded-full hover:bg-destructive/10 hover:text-destructive gap-1"
                                  onClick={() => handleDeleteProduct(p.id)}
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
                </AccordionItem>
              ))}
              {Object.keys(groupedProducts).length === 0 && !loadingProducts && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-3">
                  <Package className="w-12 h-12" />
                  <p className="font-medium">No products found. Add your first product!</p>
                </div>
              )}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Rename Category Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <form onSubmit={handleRenameCategory}>
            <DialogHeader>
              <DialogTitle>Rename Category</DialogTitle>
              <DialogDescription>
                This will update the category for all products currently in "{categoryToRename}".
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label>New Category Name</Label>
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">Rename Everywhere</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          {productToEdit && (
            <form onSubmit={handleEditProduct}>
              <DialogHeader>
                <DialogTitle>Edit Product: {productToEdit.name}</DialogTitle>
                <DialogDescription className="sr-only">
                  Update inventory details for {productToEdit.name}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-1">
                  <Label>Product Name</Label>
                  <Input name="name" defaultValue={productToEdit.name} required />
                </div>
                <div className="space-y-1">
                  <Label>SKU Code</Label>
                  <Input name="sku" defaultValue={productToEdit.sku} required />
                </div>
                <div className="space-y-1">
                  <Label>Category</Label>
                  <div className="flex gap-2">
                    {editCategoryMode ? (
                      <Input 
                        placeholder="Type new category..." 
                        value={editNewCategoryInput}
                        onChange={(e) => setEditNewCategoryInput(e.target.value)}
                        required 
                      />
                    ) : (
                      <Select value={editSelectedCategory} onValueChange={setEditSelectedCategory}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setEditCategoryMode(!editCategoryMode);
                        if (!editCategoryMode) setEditSelectedCategory("");
                        else setEditNewCategoryInput("");
                      }}
                      title={editCategoryMode ? "Cancel new category" : "Add new category"}
                    >
                      {editCategoryMode ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Supplier */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Supplier</Label>
                    <div className="col-span-3">
                      <Select value={editSelectedSupplier} onValueChange={setEditSelectedSupplier}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Purchase ₹</Label>
                    <Input name="purchasePrice" type="number" defaultValue={productToEdit.purchasePrice} />
                  </div>
                  <div className="space-y-1">
                    <Label>Selling ₹</Label>
                    <Input name="sellingPrice" type="number" defaultValue={productToEdit.sellingPrice} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Current Stock</Label>
                    <Input name="stock" type="number" defaultValue={productToEdit.stock} />
                  </div>
                  <div className="space-y-1">
                    <Label>Alert at Qty</Label>
                    <Input name="minStock" type="number" defaultValue={productToEdit.minStock} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isEditSubmitting}>
                  {isEditSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Update Details
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* All Products Directory & Stock Valuation Dialog */}
      <Dialog open={isAllProductsModalOpen} onOpenChange={setIsAllProductsModalOpen}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0 pb-3 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-headline font-bold flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-primary" />
                  <span>All Products Directory & Stock Valuation</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Complete list of all items across categories with real-time stock counts, purchase costs, and valuation.
                </DialogDescription>
              </div>

              {/* Fast Export actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button 
                  size="sm" 
                  onClick={() => handleExportCSV(modalCategoryFilter)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-8 px-2.5 font-bold gap-1 shadow-sm"
                  title="Export to Excel (.csv)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </Button>
                <a 
                  href="https://sheets.new"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleExportGoogleSheets(modalCategoryFilter)}
                  className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs h-8 px-2.5 font-bold gap-1 shadow-sm cursor-pointer transition-all"
                  title="Open in Google Sheets & copy data"
                >
                  <Boxes className="w-3.5 h-3.5" />
                  <span>Google Sheets</span>
                </a>
                <Button 
                  size="sm" 
                  onClick={() => handleExportPDF(modalCategoryFilter)}
                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs h-8 px-2.5 font-bold gap-1 shadow-sm"
                  title="Print / Download PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </Button>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
              <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Products</p>
                <p className="text-base font-bold">{modalFilteredProducts.length} <span className="text-[10px] font-normal text-muted-foreground">SKUs</span></p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Total Stock</p>
                <p className="text-base font-bold">{modalFilteredProducts.reduce((acc, p) => acc + (p.stock || 0), 0)} <span className="text-[10px] font-normal text-muted-foreground">Units</span></p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Cost Value</p>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{modalFilteredProducts.reduce((acc, p) => acc + ((p.stock || 0) * (p.purchasePrice || 0)), 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Retail Value</p>
                <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                  ₹{modalFilteredProducts.reduce((acc, p) => acc + ((p.stock || 0) * (p.sellingPrice || 0)), 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Filter by product name, SKU, or supplier..." 
                  value={modalSearch} 
                  onChange={e => setModalSearch(e.target.value)} 
                  className="pl-8 text-xs h-9 rounded-lg bg-secondary/30"
                />
              </div>

              <Select value={modalCategoryFilter} onValueChange={setModalCategoryFilter}>
                <SelectTrigger className="w-40 text-xs h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={modalSortBy} onValueChange={(val: any) => setModalSortBy(val)}>
                <SelectTrigger className="w-36 text-xs h-9">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="stock">Sort: Stock Qty</SelectItem>
                  <SelectItem value="stockValue">Sort: Stock Value</SelectItem>
                  <SelectItem value="sellingPrice">Sort: Price</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg shrink-0"
                onClick={() => setModalSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                title={modalSortOrder === "asc" ? "Ascending order" : "Descending order"}
              >
                <ArrowUpDown className={cn("w-4 h-4", modalSortOrder === "desc" && "rotate-180 transition-transform")} />
              </Button>
            </div>
          </DialogHeader>

          {/* Table Container */}
          <div className="overflow-y-auto overflow-x-auto flex-1 min-h-[300px] mt-2 rounded-xl border border-border/40">
            <Table className="min-w-[900px] sm:min-w-full">
              <TableHeader className="bg-secondary/25 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="font-bold uppercase text-[10px] w-12">#</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Product / SKU</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Category</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Supplier</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Stock Qty</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Purchase Cost</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Selling Price</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Stock Value (Cost)</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Retail Value</TableHead>
                  <TableHead className="font-bold uppercase text-[10px]">Status</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalFilteredProducts.map((p, idx) => {
                  const costVal = (p.stock || 0) * (p.purchasePrice || 0)
                  const retailVal = (p.stock || 0) * (p.sellingPrice || 0)
                  const isLow = p.stock <= p.minStock
                  const isOut = p.stock <= 0
                  return (
                    <TableRow key={p.id} className="border-border/30 hover:bg-secondary/10">
                      <TableCell className="text-xs text-muted-foreground font-mono">{idx + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-bold text-foreground text-sm">{p.name}</p>
                          <p className="text-[10px] uppercase font-mono text-muted-foreground">{p.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-semibold bg-secondary/30">
                          {p.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{p.supplierName || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("font-bold text-base", isOut ? "text-destructive" : isLow ? "text-amber-500" : "text-emerald-500")}>
                            {p.stock}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/ {p.minStock} min</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold">₹{p.purchasePrice}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-bold text-foreground">₹{p.sellingPrice}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          ₹{costVal.toLocaleString("en-IN")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          ₹{retailVal.toLocaleString("en-IN")}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isOut ? (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase font-bold">Out of Stock</Badge>
                        ) : isLow ? (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 uppercase font-bold bg-amber-500 hover:bg-amber-600">Low Stock</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">In Stock</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1">
                          {isVehicleDealer && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="rounded-full hover:bg-amber-500/10 hover:text-amber-600 gap-1 text-xs text-muted-foreground h-7 px-2"
                              onClick={() => handleOpenNotes(p)}
                              title="View & Edit Notes"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-500" />
                              {p.notes && p.notes.length > 0 && (
                                <Badge variant="secondary" className="px-1 py-0 h-3 text-[9px] bg-amber-500/15 text-amber-700 font-bold">
                                  {p.notes.length}
                                </Badge>
                              )}
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-full hover:bg-primary/10 hover:text-primary h-7 px-2 text-xs"
                            onClick={() => { 
                              setProductToEdit(p); 
                              setEditSelectedCategory(p.category); 
                              setEditSelectedSupplier(p.supplierId || "");
                              setEditCategoryMode(false);
                              setIsEditDialogOpen(true); 
                            }}
                          >
                            <Edit2 className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="rounded-full hover:bg-destructive/10 hover:text-destructive h-7 px-2 text-xs"
                            onClick={() => handleDeleteProduct(p.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            {modalFilteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 opacity-40 gap-2">
                <Package className="w-10 h-10" />
                <p className="font-medium text-xs">No matching products found.</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="mt-2 shrink-0 flex flex-row items-center justify-between sm:justify-between w-full">
            <span className="text-xs text-muted-foreground">
              Total {modalFilteredProducts.length} items listed
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsAllProductsModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Details & Notes Dialog (Only for Vehicle Dealers) */}
      {isVehicleDealer && (
        <ProductNotesDialog
          open={isNotesDialogOpen}
          onOpenChange={setIsNotesDialogOpen}
          product={productForNotes}
          userId={user?.uid}
          onProductUpdate={handleProductUpdatedFromNotes}
        />
      )}
    </div>
  )
}