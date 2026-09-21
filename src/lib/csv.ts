/** Tiny CSV helpers used by the member export. */

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Long Discord snowflakes (18-19 digits) get mangled into scientific notation
 * when spreadsheets treat them as numbers. Emitting them as `="123…"` forces
 * Excel, Google Sheets and Numbers to keep every digit as text.
 */
function textCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (text === "") return "";
  return `="${text.replace(/"/g, '""')}"`;
}

export function toCsv(
  headers: string[],
  rows: unknown[][],
  options?: { textColumns?: number[] },
): string {
  const textCols = new Set(options?.textColumns ?? []);
  const line = (row: unknown[]) =>
    row.map((value, i) => (textCols.has(i) ? textCell(value) : cell(value))).join(",");
  return [headers.map(cell).join(","), ...rows.map(line)].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";
}
