/**
 * CSV export.
 *
 * Written by hand rather than pulled from a library: the app needs one shape of
 * output, and the only genuinely tricky part is quoting, which is a few lines.
 */

/**
 * Escapes one field.
 *
 * A leading =, +, - or @ is prefixed with an apostrophe. Spreadsheets treat
 * those as the start of a formula, so a donor named "-Anil" or a note starting
 * with "=" would execute rather than display — the CSV injection problem.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  // CRLF, because Excel on Windows is the most common destination.
  return lines.join("\r\n");
}

/** Triggers a download. The BOM makes Excel read ₹ and Indian names correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** "wellington-donations-2026-08-24.csv" */
export function csvName(society: string, kind: string, on: Date = new Date()): string {
  const slug = society
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const date = on.toISOString().slice(0, 10);
  return `${slug || "society"}-${kind}-${date}.csv`;
}
