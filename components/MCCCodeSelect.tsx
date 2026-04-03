"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MCC_CODES, MCCCode } from "@/lib/mcc-codes";

interface MCCCodeSelectProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

export default function MCCCodeSelect({ value, onChange, className }: MCCCodeSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedMCC = useMemo(
    () => (value ? MCC_CODES.find((m) => m.code === value) : undefined),
    [value]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return MCC_CODES.slice(0, 10);
    const q = query.toLowerCase().trim();
    const results: MCCCode[] = [];
    for (const mcc of MCC_CODES) {
      if (results.length >= 10) break;
      if (
        mcc.code.startsWith(q) ||
        mcc.description.toLowerCase().includes(q) ||
        mcc.category.toLowerCase().includes(q)
      ) {
        results.push(mcc);
      }
    }
    return results;
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, isOpen]);

  const select = useCallback(
    (mcc: MCCCode) => {
      onChange(mcc.code);
      setQuery("");
      setIsOpen(false);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[highlightedIndex]) select(filtered[highlightedIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, filtered, highlightedIndex, select]
  );

  const riskBadge = (mcc: MCCCode) => {
    if (mcc.riskLevel === "high-risk")
      return (
        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-100 text-red-700 whitespace-nowrap">
          HIGH RISK
        </span>
      );
    if (mcc.riskLevel === "restricted")
      return (
        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700 whitespace-nowrap">
          RESTRICTED
        </span>
      );
    return null;
  };

  const categoryBadge = (mcc: MCCCode) => (
    <span className="ml-auto px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-500 whitespace-nowrap">
      {mcc.category}
    </span>
  );

  // Warning message for selected high-risk/restricted codes
  const riskWarning = selectedMCC?.riskLevel ? (
    <p className={`mt-1.5 text-xs flex items-start gap-1 ${selectedMCC.riskLevel === "high-risk" ? "text-red-600" : "text-amber-600"}`}>
      <span>⚠️</span>
      <span>
        This MCC code is classified as{" "}
        <strong>{selectedMCC.riskLevel === "high-risk" ? "High Risk" : "Restricted"}</strong>. This
        may affect underwriting approval and pricing.
      </span>
    </p>
  ) : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Selected value display or search input */}
      {value && selectedMCC && !isOpen ? (
        <div
          className={
            className ||
            "w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 text-base"
          }
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex-1 text-left truncate"
              onClick={() => {
                setIsOpen(true);
                setQuery("");
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              <span className="font-medium">{selectedMCC.code}</span>
              <span className="text-slate-400 mx-1">—</span>
              <span>{selectedMCC.description}</span>
              {riskBadge(selectedMCC)}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setQuery("");
              }}
              className="text-slate-400 hover:text-slate-600 flex-shrink-0"
              aria-label="Clear MCC code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by code, description, or category…"
          className={
            className ||
            "w-full bg-white text-slate-900 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-base"
          }
        />
      )}

      {/* Dropdown */}
      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-[320px] overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          {filtered.map((mcc, i) => (
            <li
              key={mcc.code}
              role="option"
              aria-selected={i === highlightedIndex}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
                i === highlightedIndex ? "bg-emerald-50" : "hover:bg-slate-50"
              }`}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                select(mcc);
              }}
            >
              <span className="font-semibold text-slate-900 w-12 flex-shrink-0">{mcc.code}</span>
              <span className="text-slate-700 truncate">{mcc.description}</span>
              {riskBadge(mcc)}
              {categoryBadge(mcc)}
            </li>
          ))}
        </ul>
      )}

      {isOpen && filtered.length === 0 && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg px-3 py-3 text-sm text-slate-500">
          No MCC codes found for &ldquo;{query}&rdquo;
        </div>
      )}

      {riskWarning}
    </div>
  );
}
