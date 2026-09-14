import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "../ui/Card.jsx";
import { cn } from "../../utils/cn.js";

export function KPIWidget({
  title,
  value,
  change,
  changePeriod = "vs last month",
  trend = "neutral", // "up" | "down" | "neutral"
  icon: Icon,
  className,
}) {
  const isPositive = trend === "up" || (trend !== "down" && Number(change) > 0);
  const isNegative = trend === "down" || (trend !== "up" && Number(change) < 0);

  return (
    <Card className={cn("overflow-hidden shadow-xs", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {Icon && (
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {value}
          </span>
        </div>

        {change !== undefined && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-semibold",
                isPositive && "text-emerald-600 dark:text-emerald-400",
                isNegative && "text-rose-600 dark:text-rose-400",
                !isPositive && !isNegative && "text-muted-foreground"
              )}
            >
              {isPositive && <TrendingUp className="size-3.5" />}
              {isNegative && <TrendingDown className="size-3.5" />}
              {!isPositive && !isNegative && <Minus className="size-3.5" />}
              <span>{Math.abs(Number(change))}%</span>
            </span>
            <span className="text-muted-foreground">{changePeriod}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KPIWidget;
