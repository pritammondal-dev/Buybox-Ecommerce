import React from "react";
import { cn } from "../../utils/cn.js";

export function Avatar({ src, alt = "Avatar", initials, className, size = "md" }) {
  const [imageError, setImageError] = React.useState(false);

  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-12 text-base",
    xl: "size-16 text-lg",
  };

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground ring-1 ring-border select-none",
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      {src && !imageError ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="size-full object-cover"
        />
      ) : (
        <span>{initials || alt?.slice(0, 2)?.toUpperCase() || "U"}</span>
      )}
    </div>
  );
}

export default Avatar;
