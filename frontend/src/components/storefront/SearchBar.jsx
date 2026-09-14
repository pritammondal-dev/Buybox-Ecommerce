"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X, Loader2, ArrowRight, Clock, ShoppingBag } from "lucide-react";
import { productService } from "../../services/product.service.js";
import { formatCurrency, parsePrice } from "../../utils/formatCurrency.js";
import { cn } from "../../utils/cn.js";

const RECENT_SEARCHES_KEY = "buybox_recent_searches";
const MAX_RECENT_SEARCHES = 5;

export function SearchBar({
  placeholder = "Search for products, brands and categories...",
  categories = [],
  className,
  onSearch,
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [suggestions, setSuggestions] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored).slice(0, MAX_RECENT_SEARCHES) : [];
    } catch {
      return [];
    }
  });

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const saveRecentSearch = useCallback((term) => {
    if (!term || term.trim().length < 2) return;
    const clean = term.trim();
    setRecentSearches((prev) => {
      const updated = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_RECENT_SEARCHES
      );
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((e, term) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  // Fetch predictive suggestions on debounced query
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let isCancelled = false;

    const timer = setTimeout(() => {
      setIsLoading(true);
      const params = {
        search: trimmed,
        limit: 5,
        status: "active",
      };

      if (selectedCategory && selectedCategory !== "all") {
        params.categoryId = selectedCategory;
      }

      productService
        .getProducts(params)
        .then((res) => {
          if (isCancelled) return;
          const items = res?.data?.products || (Array.isArray(res?.data) ? res.data : []);
          setSuggestions(items);
          setTotalMatches(Number(res?.meta?.total) || items.length);
          setIsLoading(false);
          setSelectedIndex(-1);
        })
        .catch(() => {
          if (isCancelled) return;
          setSuggestions([]);
          setIsLoading(false);
        });
    }, 280);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, selectedCategory]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const executeSearch = (searchTerm, cat = selectedCategory) => {
    const term = searchTerm.trim();
    if (!term) return;

    saveRecentSearch(term);
    setIsOpen(false);

    if (onSearch) {
      onSearch({ query: term, category: cat });
      return;
    }

    const params = new URLSearchParams();
    params.set("search", term);
    if (cat && cat !== "all") {
      params.set("category", cat);
    }
    router.push(`/search?${params.toString()}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) {
      inputRef.current?.focus();
      return;
    }
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      const selected = suggestions[selectedIndex];
      const targetSlug = selected.slug || selected._id;
      saveRecentSearch(selected.name);
      setIsOpen(false);
      router.push(`/product/${targetSlug}`);
      return;
    }
    executeSearch(term);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown") setIsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const showRecent = isOpen && query.trim().length < 2 && recentSearches.length > 0;
  const showSuggestions = isOpen && query.trim().length >= 2;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        onSubmit={handleSubmit}
        role="search"
        className="relative flex w-full items-center rounded-full border border-input bg-background shadow-xs transition-all focus-within:border-[#007A55] focus-within:ring-2 focus-within:ring-[#007A55]/20"
      >
        {/* Category Scope Selector (Amazon-style) */}
        {categories.length > 0 && (
          <div className="hidden md:flex items-center">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                if (query.trim()) {
                  inputRef.current?.focus();
                }
              }}
              aria-label="Filter search by category"
              className="h-10 rounded-l-full border-r border-input bg-muted/40 pl-3.5 pr-2 text-xs font-semibold text-foreground outline-none hover:bg-muted/70 cursor-pointer transition-colors max-w-[140px] truncate"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id || cat._id || cat.slug} value={cat.id || cat._id || cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Input Field */}
        <div className="relative flex flex-1 items-center">
          <Search
            className="absolute left-3.5 size-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            className="h-10 w-full rounded-full bg-transparent pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />

          {/* Clear or Loading Icon */}
          <div className="absolute right-3 flex items-center gap-1">
            {isLoading && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {query && !isLoading && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSuggestions([]);
                  inputRef.current?.focus();
                }}
                aria-label="Clear search input"
                className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          aria-label="Submit search"
          className="mr-1 size-8.5 flex shrink-0 items-center justify-center rounded-full bg-[#007A55] text-white shadow-xs hover:bg-[#006346] active:scale-95 transition-all cursor-pointer"
        >
          <Search className="size-4" />
        </button>
      </form>

      {/* Dropdown Suggestions Panel */}
      {(showSuggestions || showRecent) && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-elevated transition-all animate-in fade-in-50 zoom-in-95">
          {/* Recent Searches */}
          {showRecent && (
            <div>
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3" />
                  Recent Searches
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRecentSearches([]);
                    try {
                      localStorage.removeItem(RECENT_SEARCHES_KEY);
                    } catch {}
                  }}
                  className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer lowercase"
                >
                  Clear all
                </button>
              </div>
              <div className="space-y-0.5 pt-1">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    onClick={() => {
                      setQuery(term);
                      executeSearch(term);
                    }}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-foreground hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="size-3.5 text-muted-foreground" />
                      {term}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => removeRecentSearch(e, term)}
                      className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                      aria-label={`Remove ${term} from search history`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Predictive Suggestions */}
          {showSuggestions && (
            <div>
              {suggestions.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Matching Products
                  </div>
                  {suggestions.map((product, idx) => {
                    const id = product.id || product._id;
                    const slug = product.slug || id;
                    const priceNum = parsePrice(product.price);
                    const image = product.images?.[0]?.url || null;
                    const isSelected = selectedIndex === idx;

                    return (
                      <Link
                        key={id}
                        href={`/product/${slug}`}
                        onClick={() => {
                          saveRecentSearch(product.name);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-xl p-2 transition-colors cursor-pointer",
                          isSelected ? "bg-emerald-50 text-[#007A55]" : "hover:bg-slate-50 text-foreground"
                        )}
                      >
                        <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center">
                          {image ? (
                            <Image
                              src={image}
                              alt={product.name}
                              width={44}
                              height={44}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ShoppingBag className="size-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col overflow-hidden">
                          <span className="text-xs font-semibold truncate hover:text-[#007A55]">
                            {product.name}
                          </span>
                          <span className="text-[11px] font-extrabold text-[#007A55]">
                            {formatCurrency(priceNum)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}

                  {/* See all results link */}
                  <div className="border-t border-border mt-1 pt-1.5 px-2">
                    <button
                      type="button"
                      onClick={() => executeSearch(query)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-[#007A55] hover:bg-emerald-50 transition-colors cursor-pointer"
                    >
                      <span>
                        See all {totalMatches > 0 ? `${totalMatches} ` : ""}results for &quot;{query}&quot;
                      </span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              ) : !isLoading ? (
                <div className="py-6 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    No products found for &quot;{query}&quot;
                  </p>
                  <button
                    type="button"
                    onClick={() => executeSearch(query)}
                    className="mt-2 text-xs font-bold text-[#007A55] hover:underline cursor-pointer"
                  >
                    Search anyway
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
