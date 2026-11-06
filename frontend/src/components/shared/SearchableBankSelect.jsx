"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Landmark,
  Check,
  ChevronDown,
  X,
  Loader2,
  AlertCircle,
  Building2,
} from "lucide-react";
import { partnerBankService } from "../../services/partner-bank.service.js";

/**
 * Searchable Partner Bank Selector (Inline Combobox)
 *
 * Implements an accessible, searchable combobox against the Superadmin-managed
 * partner bank directory. The input field itself is the search and typing target.
 * Enforces selection of institutional partner bank records by persisting `partnerBankId`.
 */
export function SearchableBankSelect({
  value = null, // Selected partnerBankId (or bank object)
  onChange, // Callback with (bankObject, bankId, bankName)
  country = "IN",
  error = null,
  disabled = false,
  placeholder = "Search bank name, abbreviation, or code (e.g. HDFC, SBI, ICICI, Chase)...",
  required = true,
  label = "Partner Bank",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selectedBank, setSelectedBank] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync internal selectedBank with incoming value
  useEffect(() => {
    if (!value) {
      setSelectedBank(null);
      if (!isOpen) setQuery("");
      return;
    }

    if (typeof value === "object" && (value.id || value._id)) {
      setSelectedBank(value);
      if (!isOpen) setQuery(value.name || "");
      return;
    }

    if (typeof value === "string") {
      // Check if bank already exists in current list
      const match = banks.find((b) => (b.id || b._id) === value);
      if (match) {
        setSelectedBank(match);
        if (!isOpen) setQuery(match.name || "");
      } else {
        // Fetch specific bank details by ID
        partnerBankService
          .getPartnerBank(value)
          .then((res) => {
            const b = res.bank || res;
            if (b && (b.id || b._id)) {
              setSelectedBank(b);
              if (!isOpen) setQuery(b.name || "");
            }
          })
          .catch(() => {});
      }
    }
  }, [value, banks, isOpen]);

  // Debounced search query
  const performSearch = useCallback(
    async (searchTerm) => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await partnerBankService.searchPartnerBanks({
          search: searchTerm ? searchTerm.trim() : undefined,
          country: country ? country.toUpperCase() : undefined,
          limit: 30,
        });
        const items = res.items || [];
        setBanks(items);
        setHighlightedIndex(items.length > 0 ? 0 : -1);
      } catch (err) {
        setFetchError(err?.message || "Failed to query partner bank directory");
      } finally {
        setLoading(false);
      }
    },
    [country]
  );

  // Reset and fetch initial directory when country changes
  useEffect(() => {
    performSearch("");
  }, [country, performSearch]);

  // Handle typing inside combobox input
  const handleInputChange = (e) => {
    const nextVal = e.target.value;
    setQuery(nextVal);

    // If text modified after selecting a bank, invalidate previous selection
    if (selectedBank && selectedBank.name !== nextVal) {
      setSelectedBank(null);
      onChange?.(null, null, "");
    }

    if (!isOpen) {
      setIsOpen(true);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(nextVal);
    }, 250);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        // If input closed without selecting and text doesn't match selected bank, reset display
        if (selectedBank) {
          setQuery(selectedBank.name);
        } else if (!value) {
          setQuery("");
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [selectedBank, value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelectBank = (bank) => {
    setSelectedBank(bank);
    setQuery(bank.name);
    setIsOpen(false);
    onChange?.(bank, bank.id || bank._id, bank.name);
    inputRef.current?.blur();
  };

  const handleClearSelection = (e) => {
    e.stopPropagation();
    setSelectedBank(null);
    setQuery("");
    setIsOpen(false);
    onChange?.(null, null, "");
    performSearch("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        if (banks.length === 0) performSearch(query);
      } else {
        setHighlightedIndex((prev) => (prev < banks.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : banks.length - 1));
      }
    } else if (e.key === "Enter") {
      if (isOpen && highlightedIndex >= 0 && banks[highlightedIndex]) {
        e.preventDefault();
        handleSelectBank(banks[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        if (selectedBank) setQuery(selectedBank.name);
      }
    } else if (e.key === "Tab") {
      if (isOpen) {
        setIsOpen(false);
        if (selectedBank) setQuery(selectedBank.name);
      }
    }
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Landmark className="size-3.5 text-slate-400" />
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </span>
          <span className="text-[10px] text-slate-400 font-normal">
            Directory verified
          </span>
        </label>
      )}

      {/* Main Combobox Input Field */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Search className="size-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          disabled={disabled}
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              if (banks.length === 0) performSearch(query);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          className={`w-full pl-9 pr-16 py-2.5 rounded-xl border text-xs text-slate-900 bg-white placeholder:text-slate-400 transition-all ${
            disabled
              ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
              : isOpen
              ? "border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs"
              : error
              ? "border-rose-300 bg-rose-50/20 focus:border-rose-500 focus:ring-2 focus:ring-rose-200"
              : "border-slate-200 hover:border-slate-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
          }`}
        />

        {/* Action icons on right */}
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1">
          {loading && (
            <Loader2 className="size-3.5 text-emerald-600 animate-spin mr-0.5" />
          )}

          {(query || selectedBank) && !disabled && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Clear bank selection"
              aria-label="Clear bank selection"
            >
              <X className="size-3.5" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (!disabled) {
                setIsOpen(!isOpen);
                if (!isOpen) {
                  inputRef.current?.focus();
                  if (banks.length === 0) performSearch(query);
                }
              }
            }}
            className="p-1 text-slate-400 hover:text-slate-600 transition-transform"
            aria-label="Toggle directory options"
          >
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-emerald-600" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Selected Bank Details Pill */}
      {selectedBank && (
        <div className="mt-1.5 p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between text-[11px] text-emerald-950">
          <div className="flex items-center gap-2 truncate">
            <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-bold truncate">{selectedBank.name}</span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-semibold">
              {selectedBank.code}
            </span>
            {selectedBank.routingSystem && (
              <span className="hidden sm:inline text-[10px] text-emerald-700 font-medium">
                ({selectedBank.routingSystem})
              </span>
            )}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium shrink-0 flex items-center gap-1">
            <Check className="size-3 text-emerald-600" />
            Partner Verified
          </span>
        </div>
      )}

      {/* Floating Results Listbox */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            <span>Partner Bank Directory ({country})</span>
            {banks.length > 0 && <span>{banks.length} options</span>}
          </div>

          <div
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1 scrollbar-thin"
          >
            {loading && banks.length === 0 && (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="size-4 animate-spin text-emerald-600" />
                <span>Searching partner directory...</span>
              </div>
            )}

            {!loading && fetchError && (
              <div className="p-3 text-xs text-rose-600 bg-rose-50 rounded-xl flex items-center gap-2 m-1">
                <AlertCircle className="size-4 shrink-0" />
                <span>{fetchError}</span>
              </div>
            )}

            {!loading && !fetchError && banks.length === 0 && (
              <div className="py-7 text-center px-4">
                <Building2 className="size-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-800">
                  No matching partner banks found
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Check the spelling or try searching by official bank acronym
                </p>
              </div>
            )}

            {banks.map((b, idx) => {
              const isSelected =
                selectedBank &&
                (selectedBank.id || selectedBank._id) === (b.id || b._id);
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={b.id || b._id || idx}
                  id={`bank-option-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    // Prevent blur before selection fires
                    e.preventDefault();
                    handleSelectBank(b);
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-950 font-bold"
                      : isHighlighted
                      ? "bg-slate-100 text-slate-900"
                      : "hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{b.name}</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-medium border border-slate-200">
                        {b.code}
                      </span>
                      {b.routingSystem && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-100">
                          {b.routingSystem}
                        </span>
                      )}
                    </div>
                    {b.aliases && b.aliases.length > 0 && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        Aliases: {b.aliases.join(", ")}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="size-4 text-emerald-600 shrink-0 ml-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[11px] text-rose-500 font-semibold flex items-center gap-1">
          <AlertCircle className="size-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export default SearchableBankSelect;
