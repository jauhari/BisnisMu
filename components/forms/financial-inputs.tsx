"use client";

import type React from "react";
import { useCallback } from "react";

/** Strip semua non-digit dari input */
function stripNonDigit(s: string): string {
  return s.replace(/[^\d]/g, "");
}

/** Format digit mentah jadi ribuan IDR: "1500000" → "1.500.000" */
function formatIdr(digits: string): string {
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

function displayFor(rawDigits: string, prefix: boolean): string {
  const number = formatIdr(rawDigits);
  if (!number) return "";
  return prefix ? `Rp ${number}` : number;
}

/** Hitung berapa karakter digit ada di sebelah kiri posisi `pos` pada string `s`. */
function digitsBefore(s: string, pos: number): number {
  let count = 0;
  for (let i = 0; i < pos && i < s.length; i++) {
    if (s.charAt(i) >= "0" && s.charAt(i) <= "9") count++;
  }
  return count;
}

/** Cari index tepat setelah digit ke-N pada string terformat (melompati separator/prefix). */
function indexAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted.charAt(i) >= "0" && formatted.charAt(i) <= "9") {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
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
 * Input uang dengan format ribuan IDR yang tampil langsung saat mengetik.
 * onChange dipanggil dengan raw digits string, mis. "1500000". Posisi kursor
 * dipertahankan manual di `handleChange` (tulis langsung ke DOM node sebelum
 * React commit) supaya penyisipan titik pemisah tidak melempar kursor ke akhir teks.
 */
export function MoneyField({ value, onChange, onBlur, onFocus, prefix = false, className = "", placeholder = "0", disabled, autoFocus }: MoneyFieldProps) {
  const rawStr = String(value ?? "").replace(/[^\d]/g, "");
  const displayValue = displayFor(rawStr, prefix);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const cursorPos = el.selectionStart ?? el.value.length;
    const digitCount = digitsBefore(el.value, cursorPos);
    const raw = stripNonDigit(el.value);
    const newDisplay = displayFor(raw, prefix);
    const newPos = indexAfterDigits(newDisplay, digitCount);

    el.value = newDisplay;
    el.setSelectionRange(newPos, newPos);

    onChange(raw);
  }, [onChange, prefix]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => e.target.select(), 0);
    onFocus?.(e);
  }, [onFocus]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`block tabular-nums ${className}`}
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
