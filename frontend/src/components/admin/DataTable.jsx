"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpDown, ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../ui/Table.jsx";
import { Checkbox } from "../ui/Checkbox.jsx";
import { Pagination } from "../ui/Pagination.jsx";
import { TableToolbar } from "./TableToolbar.jsx";
import { ColumnSelector } from "./ColumnSelector.jsx";
import { BulkActions } from "./BulkActions.jsx";
import { AdminEmptyState } from "./AdminEmptyState.jsx";
import { AdminTableSkeleton } from "./AdminSkeleton.jsx";
import { cn } from "../../utils/cn.js";

export function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  keyExtractor = (item, idx) => item.id || item._id || idx,
  enableSelection = false,
  enableSearch = true,
  searchPlaceholder = "Search records...",
  searchKey,
  bulkActions,
  toolbarActions,
  emptyTitle = "No records found",
  emptyDescription = "There are no records matching your query.",
  pageSize = 10,
  className,
}) {
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [visibleColumnIds, setVisibleColumnIds] = useState(
    columns.map((c) => c.id)
  );
  const [currentPage, setCurrentPage] = useState(1);

  // Toggle single row selection
  const handleSelectRow = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Toggle select all
  const handleSelectAll = (filteredData) => {
    if (selectedKeys.size === filteredData.length) {
      setSelectedKeys(new Set());
    } else {
      const allKeys = new Set(filteredData.map(keyExtractor));
      setSelectedKeys(allKeys);
    }
  };

  // Toggle column visibility
  const handleToggleColumn = (colId) => {
    setVisibleColumnIds((prev) =>
      prev.includes(colId)
        ? prev.filter((id) => id !== colId)
        : [...prev, colId]
    );
  };

  // Sorting
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  // Filter & Sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Search filter
    if (searchQuery.trim() && searchKey) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const val = item[searchKey];
        return String(val || "").toLowerCase().includes(q);
      });
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, searchKey, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const activeColumns = columns.filter((col) =>
    visibleColumnIds.includes(col.id)
  );

  if (isLoading) {
    return <AdminTableSkeleton rows={pageSize} columns={columns.length} />;
  }

  const allSelected =
    processedData.length > 0 && selectedKeys.size === processedData.length;
  const isIndeterminate =
    selectedKeys.size > 0 && selectedKeys.size < processedData.length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Top Toolbar */}
      {enableSearch && (
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          placeholder={searchPlaceholder}
          actions={
            <div className="flex items-center gap-2">
              <ColumnSelector
                columns={columns}
                visibleColumns={visibleColumnIds}
                onToggleColumn={handleToggleColumn}
              />
              {toolbarActions}
            </div>
          }
        />
      )}

      {/* Table Container */}
      <div className="rounded-lg border bg-card shadow-2xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              {enableSelection && (
                <TableHead className="w-10 text-center">
                  <Checkbox
                    checked={allSelected}
                    onChange={() => handleSelectAll(processedData)}
                    aria-label="Select all rows"
                  />
                </TableHead>
              )}

              {activeColumns.map((col) => (
                <TableHead
                  key={col.id}
                  className={cn(
                    "text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none",
                    col.sortable && "cursor-pointer hover:text-foreground",
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.id) : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="size-3.5 flex items-center justify-center">
                        {sortConfig.key === col.id ? (
                          sortConfig.direction === "asc" ? (
                            <ChevronUp className="size-3 text-primary" />
                          ) : (
                            <ChevronDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={activeColumns.length + (enableSelection ? 1 : 0)}
                  className="h-48 text-center p-0"
                >
                  <AdminEmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    className="border-0 rounded-none bg-transparent"
                  />
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => {
                const key = keyExtractor(item, index);
                const isSelected = selectedKeys.has(key);

                return (
                  <TableRow
                    key={key}
                    data-state={isSelected ? "selected" : undefined}
                    className="hover:bg-muted/40 transition-colors"
                  >
                    {enableSelection && (
                      <TableCell className="w-10 text-center">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleSelectRow(key)}
                          aria-label={`Select row ${key}`}
                        />
                      </TableCell>
                    )}

                    {activeColumns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn("text-xs py-3", col.className)}
                      >
                        {col.render ? col.render(item, index) : item[col.id]}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {processedData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t bg-muted/10 text-xs text-muted-foreground">
            <div>
              Showing {Math.min((currentPage - 1) * pageSize + 1, processedData.length)} to{" "}
              {Math.min(currentPage * pageSize, processedData.length)} of{" "}
              {processedData.length} records
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Floating Bulk Actions Bar */}
      {enableSelection && (
        <BulkActions
          selectedCount={selectedKeys.size}
          onClearSelection={() => setSelectedKeys(new Set())}
        >
          {bulkActions?.(Array.from(selectedKeys))}
        </BulkActions>
      )}
    </div>
  );
}

export default DataTable;
