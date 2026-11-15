import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon, Eye, EyeOff, ArrowUpRight } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: string
    positive: boolean
  }
  description?: string
  colorClass?: string
  isHidden?: boolean
  showEyeToggle?: boolean
  onToggleHide?: () => void
  onClick?: () => void
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  colorClass,
  isHidden = false,
  showEyeToggle = false,
  onToggleHide,
  onClick,
}: StatCardProps) {
  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        "overflow-hidden border border-border/50 bg-card shadow-sm transition-all duration-300 group",
        onClick
          ? "cursor-pointer hover:border-primary/50 hover:shadow-lg hover:-translate-y-1 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          : "hover:shadow-md"
      )}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wider truncate group-hover:text-foreground transition-colors">
                {title}
              </p>
              {showEyeToggle && onToggleHide && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleHide()
                  }}
                  className="p-1 -my-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
                  title={isHidden ? "Show amount" : "Hide amount"}
                  aria-label={isHidden ? "Show amount" : "Hide amount"}
                >
                  {isHidden ? (
                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground/70" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-foreground" />
                  )}
                </button>
              )}
            </div>

            <h3 className="text-xl sm:text-2xl md:text-3xl font-code font-bold text-foreground tracking-tight">
              {isHidden ? (
                <span className="text-muted-foreground/80 tracking-widest font-mono text-lg sm:text-2xl select-none">
                  ₹••••••
                </span>
              ) : (
                value
              )}
            </h3>

            {trend && (
              <div className="flex items-center mt-2 gap-1.5 flex-wrap">
                <span
                  className={cn(
                    "text-xs font-bold px-1.5 py-0.5 rounded",
                    trend.positive ? "text-accent bg-accent/10" : "text-destructive bg-destructive/10"
                  )}
                >
                  {trend.positive ? "+" : ""}
                  {trend.value}
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">vs last month</span>
              </div>
            )}
            {description && !trend && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 truncate">{description}</p>
            )}

            {onClick && (
              <div className="flex items-center gap-1 mt-2.5 text-[10px] sm:text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                <span>View details</span>
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            )}
          </div>

          <div
            className={cn(
              "p-2.5 sm:p-3 rounded-xl transition-all group-hover:scale-110 group-hover:bg-primary/20 shrink-0",
              colorClass || "bg-secondary text-primary"
            )}
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}