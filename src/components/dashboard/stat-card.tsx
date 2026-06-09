import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

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
}

export function StatCard({ title, value, icon: Icon, trend, description, colorClass }: StatCardProps) {
  return (
    <Card className="overflow-hidden border-none bg-card shadow-sm hover:shadow-md transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-code font-bold text-foreground">
              {value}
            </h3>
            {trend && (
              <div className="flex items-center mt-2 gap-1.5">
                <span className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded",
                  trend.positive ? "text-accent bg-accent/10" : "text-destructive bg-destructive/10"
                )}>
                  {trend.positive ? "+" : ""}{trend.value}
                </span>
                <span className="text-xs text-muted-foreground">vs last month</span>
              </div>
            )}
            {description && !trend && (
              <p className="text-xs text-muted-foreground mt-2">{description}</p>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl transition-colors group-hover:bg-primary/20",
            colorClass || "bg-secondary text-primary"
          )}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}