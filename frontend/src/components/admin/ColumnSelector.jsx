"use client";

import React from "react";
import { Columns } from "lucide-react";
import { DropdownMenu, DropdownMenuLabel, DropdownMenuSeparator } from "../ui/DropdownMenu.jsx";
import { Checkbox } from "../ui/Checkbox.jsx";
import { Button } from "../ui/Button.jsx";

export function ColumnSelector({
  columns = [],
  visibleColumns = [],
  onToggleColumn,
  className,
}) {
  return (
    <DropdownMenu
      align="right"
      className={className}
      trigger={
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Columns className="size-3.5" />
          <span>Columns</span>
        </Button>
      }
    >
      <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <div className="p-2 space-y-2 max-h-56 overflow-y-auto">
        {columns.map((col) => {
          const isChecked = visibleColumns.includes(col.id);

          return (
            <div key={col.id} className="flex items-center gap-2">
              <Checkbox
                id={`col-toggle-${col.id}`}
                checked={isChecked}
                onChange={() => onToggleColumn?.(col.id)}
              />
              <label
                htmlFor={`col-toggle-${col.id}`}
                className="cursor-pointer text-xs font-medium text-foreground select-none"
              >
                {col.label}
              </label>
            </div>
          );
        })}
      </div>
    </DropdownMenu>
  );
}

export default ColumnSelector;
