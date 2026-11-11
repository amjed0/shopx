"use client"

import * as React from "react"
import {
  FileText,
  Calendar,
  Clock,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Wrench,
  Car,
  Bike,
  Sparkles,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import type { Product, ProductNote } from "@/app/(dashboard)/inventory/page"

interface ProductNotesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  userId?: string
  onProductUpdate: (updatedProduct: Product) => void
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  Renewal: {
    label: "Renewal",
    icon: Calendar,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  "Vehicle Details": {
    label: "Vehicle Details",
    icon: Car,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  Service: {
    label: "Service & Maintenance",
    icon: Wrench,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  Remark: {
    label: "General Remark",
    icon: FileText,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
}

const DEALER_PRESETS = [
  { title: "Insurance Renewal", category: "Renewal", placeholder: "Policy No, Provider, Insured Amount, Next renewal date..." },
  { title: "PUC / Pollution Expiry", category: "Renewal", placeholder: "Certificate No, Emission testing center, Expiry date..." },
  { title: "RC & Hypothecation", category: "Vehicle Details", placeholder: "Reg No, Chassis No, Engine No, RTO location, Bank NOC..." },
  { title: "Chassis & Engine Details", category: "Vehicle Details", placeholder: "Chassis / VIN: \nEngine No: \nColor: \nManufacturing Year: " },
  { title: "Service & Oil Change", category: "Service", placeholder: "Odometer KM, Oil replaced, Spark plugs checked, Next service at..." },
  { title: "Fitness / Road Tax", category: "Renewal", placeholder: "Tax validity date, Fitness cert expiry, Receipt no..." },
]

export function ProductNotesDialog({
  open,
  onOpenChange,
  product,
  userId,
  onProductUpdate,
}: ProductNotesDialogProps) {
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null)
  const [category, setCategory] = React.useState<string>("Renewal")
  const [title, setTitle] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [content, setContent] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [deletingNoteId, setDeletingNoteId] = React.useState<string | null>(null)

  // Reset form when dialog opens/closes or product changes
  React.useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open, product?.id])

  const resetForm = () => {
    setEditingNoteId(null)
    setCategory("Renewal")
    setTitle("")
    setDueDate("")
    setContent("")
  }

  const handleStartEdit = (note: ProductNote) => {
    setEditingNoteId(note.id)
    setCategory(note.category || "Renewal")
    setTitle(note.title || "")
    setDueDate(note.dueDate || "")
    setContent(note.content || "")
    // Scroll form into view
    const formElement = document.getElementById("product-note-form")
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }

  const handleApplyPreset = (preset: (typeof DEALER_PRESETS)[0]) => {
    setCategory(preset.category)
    setTitle(preset.title)
    if (!content) {
      setContent(preset.placeholder)
    }
  }

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!product || !userId) return

    if (!title.trim() && !content.trim()) {
      toast({
        variant: "destructive",
        title: "Required Information",
        description: "Please enter a note title or details.",
      })
      return
    }

    try {
      setIsSubmitting(true)

      const existingNotes = product.notes || []
      let updatedNotes: ProductNote[] = []

      if (editingNoteId) {
        // Edit existing note
        updatedNotes = existingNotes.map((n) =>
          n.id === editingNoteId
            ? {
                ...n,
                category,
                title: title.trim() || "Remark",
                dueDate: dueDate || "",
                content: content.trim(),
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      } else {
        // Create new note
        const newNote: ProductNote = {
          id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          category,
          title: title.trim() || "Remark",
          dueDate: dueDate || "",
          content: content.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        updatedNotes = [newNote, ...existingNotes]
      }

      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        credentials: "include",
        body: JSON.stringify({ notes: updatedNotes }),
      })

      if (!res.ok) throw new Error("Failed to save note")

      const updatedProduct: Product = await res.json()
      onProductUpdate(updatedProduct)

      toast({
        title: editingNoteId ? "Note Updated" : "Note Saved",
        description: editingNoteId
          ? "Note changes have been saved."
          : `Added note "${title || "Remark"}" to product.`,
      })

      resetForm()
    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not save product note. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!product || !userId) return
    if (!confirm("Are you sure you want to delete this note?")) return

    try {
      setDeletingNoteId(noteId)
      const updatedNotes = (product.notes || []).filter((n) => n.id !== noteId)

      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        credentials: "include",
        body: JSON.stringify({ notes: updatedNotes }),
      })

      if (!res.ok) throw new Error("Failed to delete note")

      const updatedProduct: Product = await res.json()
      onProductUpdate(updatedProduct)

      if (editingNoteId === noteId) {
        resetForm()
      }

      toast({
        title: "Note Removed",
        description: "The note was deleted successfully.",
      })
    } catch (err) {
      console.error(err)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not delete note.",
      })
    } finally {
      setDeletingNoteId(null)
    }
  }

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const getDueStatus = (dueDateStr?: string) => {
    if (!dueDateStr) return null
    const due = new Date(dueDateStr).getTime()
    if (isNaN(due)) return null
    const diffDays = (due - Date.now()) / (1000 * 60 * 60 * 24)
    if (diffDays < 0) {
      return {
        label: "Overdue",
        badgeClass: "bg-destructive/15 text-destructive border-destructive/30",
        icon: AlertTriangle,
      }
    }
    if (diffDays <= 7) {
      return {
        label: "Due Soon",
        badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        icon: Clock,
      }
    }
    return {
      label: "Scheduled",
      badgeClass: "bg-primary/10 text-primary border-primary/20",
      icon: Calendar,
    }
  }

  const notesList = product?.notes || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-headline">
                Product Details & Notes
              </DialogTitle>
              <DialogDescription className="text-xs">
                Manage vehicle specs, renewal reminders, date/time alerts, and remarks.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {product && (
          <div className="space-y-6 pt-2">
            {/* Top Product Summary Card */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {product.name}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">
                    SKU: <span className="text-foreground font-semibold">{product.sku}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-background text-xs font-medium">
                    {product.category}
                  </Badge>
                  <Badge
                    variant={product.stock <= product.minStock ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    Stock: {product.stock} units
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                    Selling Price
                  </span>
                  <span className="text-sm font-bold text-foreground">₹{product.sellingPrice}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                    Purchase Price
                  </span>
                  <span className="text-sm font-bold text-foreground">₹{product.purchasePrice}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                    Supplier
                  </span>
                  <span className="text-sm font-medium text-foreground truncate block">
                    {product.supplierName || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block">
                    Saved Notes
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {notesList.length} {notesList.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Dealer Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Quick Dealer Presets
                </Label>
                <span className="text-[11px] text-muted-foreground">Click to auto-fill form</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEALER_PRESETS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border/60 bg-secondary/30 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all text-muted-foreground"
                  >
                    + {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Note Editor Form */}
            <form
              id="product-note-form"
              onSubmit={handleSaveNote}
              className={cn(
                "p-4 rounded-xl border transition-all space-y-4",
                editingNoteId
                  ? "border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20"
                  : "border-border/60 bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {editingNoteId ? (
                    <>
                      <Pencil className="w-4 h-4 text-amber-500" />
                      <h4 className="font-bold text-sm text-foreground">
                        Editing Note: <span className="text-amber-600 dark:text-amber-400 font-semibold">{title || "Untitled"}</span>
                      </h4>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-primary" />
                      <h4 className="font-bold text-sm text-foreground">Add New Note / Renewal</h4>
                    </>
                  )}
                </div>
                {editingNoteId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel Edit
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Note Type / Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Renewal">🔄 Renewal (Insurance, PUC, Tax, Fitness)</SelectItem>
                      <SelectItem value="Vehicle Details">🏍️ Vehicle / Bike Details (VIN, Engine, Specs)</SelectItem>
                      <SelectItem value="Service">🛠️ Service & Maintenance</SelectItem>
                      <SelectItem value="Remark">📝 General Remark / Notes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Title / Subject</Label>
                  <Input
                    placeholder="e.g. Insurance Expiry, Chassis No, Next Service"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    Renewal / Reminder Date & Time (Optional)
                  </Label>
                  <Input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Set a target date & time for insurance renewals, test expiry, service due, or registration.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Remarks & Specific Details</Label>
                  <Textarea
                    placeholder="Type details, policy number, engine/chassis number, customer remarks, or renewal notes here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                    className="text-sm font-sans resize-y"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {editingNoteId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className={cn(
                    "gap-1.5",
                    editingNoteId ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                  )}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingNoteId ? (
                    <Pencil className="w-3.5 h-3.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  {editingNoteId ? "Update Note" : "Save Note"}
                </Button>
              </div>
            </form>

            {/* List of Existing Notes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold font-headline text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Product Notes & Remarks History
                  <Badge variant="secondary" className="text-xs">
                    {notesList.length}
                  </Badge>
                </h4>
              </div>

              {notesList.length === 0 ? (
                <div className="p-8 text-center border border-dashed rounded-xl border-border/60 bg-muted/20 space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No notes recorded yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Add vehicle details, renewal reminders, or remarks above. They will be saved with timestamps and date alerts.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notesList.map((note) => {
                    const cfg = CATEGORY_CONFIG[note.category || "Remark"] || CATEGORY_CONFIG["Remark"]
                    const IconComponent = cfg.icon
                    const dueStatus = getDueStatus(note.dueDate)
                    const isCurrentlyEditing = editingNoteId === note.id

                    return (
                      <div
                        key={note.id}
                        className={cn(
                          "p-4 rounded-xl border transition-all space-y-3",
                          isCurrentlyEditing
                            ? "border-amber-500 bg-amber-500/5 shadow-sm ring-1 ring-amber-500/30"
                            : "border-border/60 bg-card hover:border-border"
                        )}
                      >
                        {/* Note Header: Badge, Title & Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                                  cfg.bg,
                                  cfg.color
                                )}
                              >
                                <IconComponent className="w-3 h-3" />
                                {cfg.label}
                              </span>

                              {dueStatus && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] px-2 py-0.5 font-bold uppercase tracking-wide gap-1 border",
                                    dueStatus.badgeClass
                                  )}
                                >
                                  <dueStatus.icon className="w-3 h-3" />
                                  {dueStatus.label}: {formatDisplayDate(note.dueDate)}
                                </Badge>
                              )}
                            </div>

                            <h5 className="font-bold text-base text-foreground pt-0.5">
                              {note.title}
                            </h5>
                          </div>

                          {/* Action Buttons: Edit (Pencil) & Delete */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 px-2.5 rounded-full text-xs gap-1",
                                isCurrentlyEditing
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold"
                                  : "hover:bg-primary/10 hover:text-primary text-muted-foreground"
                              )}
                              onClick={() => handleStartEdit(note)}
                              title="Edit this note"
                            >
                              <Pencil className="w-3.5 h-3.5 text-amber-500" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDeleteNote(note.id)}
                              disabled={deletingNoteId === note.id}
                              title="Delete this note"
                            >
                              {deletingNoteId === note.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>

                        {/* Note Content / Remarks */}
                        {note.content && (
                          <div className="p-3 rounded-lg bg-secondary/20 text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 font-sans border border-border/30">
                            {note.content}
                          </div>
                        )}

                        {/* Timestamps Footer */}
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30 gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 opacity-60" />
                            Created: {formatDisplayDate(note.createdAt)}
                          </span>
                          {note.updatedAt && note.updatedAt !== note.createdAt && (
                            <span className="italic opacity-70">
                              (Updated: {formatDisplayDate(note.updatedAt)})
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

