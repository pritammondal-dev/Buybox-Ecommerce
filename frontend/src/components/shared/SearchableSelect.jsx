"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

/**
 * Reusable Searchable Select Component
 *
 * Provides a searchable dropdown for static or fetched lists (e.g. Countries, States/Provinces).
 * Supports keyboard navigation (ArrowDown, ArrowUp, Enter, Escape).
 */
export function SearchableSelect({
  options = [], // Array of string or { value, label, sublabel }
  value = "",
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to filter...",
  disabled = false,
  error = null,
  required = false,
  label = null,
  id = undefined,
  clearable = true,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listboxRef = useRef(null);

  // Normalize options to uniform { value, label, sublabel } structure
  const normalizedOptions = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === "string") {
        return { value: opt, label: opt, sublabel: null };
      }
      return {
        value: opt.value ?? opt.code ?? opt.id,
        label: opt.label ?? opt.name ?? String(opt.value),
        sublabel: opt.sublabel ?? opt.code ?? null,
      };
    });
  }, [options]);

  // Selected item label
  const selectedOption = normalizedOptions.find((o) => o.value === value) || null;

  // Filtered options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase().trim();
    return normalizedOptions.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(term);
      const sublabelMatch = opt.sublabel && opt.sublabel.toLowerCase().includes(term);
      const valueMatch = String(opt.value).toLowerCase().includes(term);
      return labelMatch || sublabelMatch || valueMatch;
    });
  }, [normalizedOptions, searchTerm]);

  // Reset highlighted index on filter changes
  useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [filteredOptions]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelect = (opt) => {
    onChange?.(opt.value, opt);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.("", null);
    setSearchTerm("");
  };

  // Keyboard navigation within listbox
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      }
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-bold text-slate-700 mb-1"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main trigger element */}
      <div
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left cursor-pointer transition-all ${
          disabled
            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
            : isOpen
            ? "border-emerald-600 ring-2 ring-emerald-500/20 bg-white"
            : error
            ? "border-rose-300 bg-rose-50/20 hover:border-rose-400"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}
      >
        <span
          className={`text-xs truncate ${
            selectedOption ? "font-semibold text-slate-900" : "text-slate-400"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown
            className={`size-4 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search filter input */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80">
            <div className="relative flex items-center">
              <Search className="size-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-7 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options listbox */}
          <ul
            ref={listboxRef}
            role="listbox"
            className="max-h-56 overflow-y-auto divide-y divide-slate-50 p-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="py-6 text-center text-xs text-slate-400">
                No matching options found
              </li>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = selectedOption?.value === opt.value;
                const isHighlighted = highlightedIndex === index;

                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50 text-emerald-900 font-semibold"
                        : isHighlighted
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && opt.sublabel !== opt.label && (
                        <span className="ml-2 font-mono text-[10px] text-slate-400">
                          ({opt.sublabel})
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="size-3.5 text-emerald-600 shrink-0" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
}

export default SearchableSelect;

