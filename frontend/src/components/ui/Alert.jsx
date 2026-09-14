import React from "react";
import { cva } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "../../utils/cn.js";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        info: "border-info/50 text-info [&>svg]:text-info bg-info/5",
        success: "border-success/50 text-success [&>svg]:text-success bg-success/5",
        warning: "border-warning/50 text-warning [&>svg]:text-warning bg-warning/5",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const iconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
};

export const Alert = React.forwardRef(
  ({ className, variant = "default", icon, children, ...props }, ref) => {
    const IconComponent = icon || iconMap[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {IconComponent && <IconComponent aria-hidden="true" />}
        {children}
      </div>
    );
  }
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    >
      {children}
    </h5>
  )
);
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
);
AlertDescription.displayName = "AlertDescription";

export default Alert;
