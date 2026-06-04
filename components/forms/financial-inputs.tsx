"use client";

import type React from "react";
import { useCallback, useRef, useState } from "react";

/** Format angka jadi ribuan IDR: 1500000 → "1.500.000" */
function formatIdr(raw: string | number): string {
  const n = typeof raw === "number" ? raw : Number(raw.replace(/[^\d]/g, "")) || 0;
  if (!n) return "";
  return n.toLocaleString("id-ID");
}

/** Strip semua non-digit dari input */
function stripNonDigit(s: string): string {
  return s.replace(/[^\d]/g, "");
}

interface MoneyFieldProps {
  value: string | number;
  onChange: (rawValue: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  /** Tampilkan prefix "Rp" di display (default: false) */
  prefix?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Input uang dengan format ribuan IDR.
 * - Saat blur: tampil "1.500.000" (mudah dibaca)
 * - Saat focus: tampil "1500000" (mudah diedit)
 * - onChange dipanggil dengan raw digits string, mis. "1500000"
 */
export function MoneyField({ value, onChange, onBlur, onFocus, prefix = false, className = "", placeholder = "0", disabled, autoFocus }: MoneyFieldProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rawStr = String(value ?? "").replace(/[^\d]/g, "");
  const displayValue = focused ? rawStr : (rawStr ? (prefix ? "Rp " + formatIdr(rawStr) : formatIdr(rawStr)) : "");

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = stripNonDigit(e.target.value);
    onChange(raw);
  }, [onChange]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    setTimeout(() => e.target.select(), 0);
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(e);
  }, [onBlur]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`tabular-nums ${className}`}
    />
  );
}

/** MoneyField dengan styling standar form BisnisMu */
export function MoneyInput({ value, onChange, className = "", ...rest }: MoneyFieldProps) {
  return (
    <MoneyField
      value={value}
      onChange={onChange}
      className={`h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm text-right ${className}`}
      {...rest}
    />
  );
}

/** PercentInput — angka 0–100 */
export function PercentInput({ value, onChange, className = "", ...rest }: Omit<MoneyFieldProps, "prefix">) {
  return (
    <MoneyField
      value={value}
      onChange={onChange}
      className={`h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm text-right ${className}`}
      placeholder="0"
      {...rest}
    />
  );
}
