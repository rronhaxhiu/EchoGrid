import type { VariableConfig } from "@/types/simulation";

export interface ParsedCsv {
  rows: number[][];
  headers: string[] | null;
  rowCount: number;
  columnCount: number;
  /** Per-column [min, max] in the raw file before normalization. */
  rawColumnRanges: { min: number; max: number }[];
}

const COLUMN_COLORS = [
  "#34D399", "#FBBF24", "#6EE7B7", "#818CF8", "#F472B6", "#38BDF8",
  "#A78BFA", "#FB923C", "#2DD4BF", "#F87171", "#4ADE80", "#60A5FA",
  "#C084FC", "#FACC15", "#22D3EE",
];

function slugifyColumnName(label: string, index: number, used: Set<string>): string {
  let slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!slug) slug = `column_${index + 1}`;
  if (!/^[a-z]/.test(slug)) slug = `col_${slug}`;

  const base = slug;
  let n = 1;
  while (used.has(slug)) {
    slug = `${base}_${n++}`;
  }
  used.add(slug);
  return slug;
}

/** Build simulation variables from CSV columns (headers → names, or Column 1, 2, …). */
export function buildVariableConfigsFromCsv(parsed: ParsedCsv): VariableConfig[] {
  const { rows, headers, columnCount } = parsed;
  const used = new Set<string>();

  return Array.from({ length: columnCount }, (_, j) => {
    const displayName = (headers?.[j]?.trim() || `Column ${j + 1}`).replace(/^"|"$/g, "");
    const name = slugifyColumnName(displayName, j, used);
    const colValues = rows.map((r) => r[j] ?? 0);
    const initial_value =
      colValues.length > 0
        ? colValues.reduce((a, b) => a + b, 0) / colValues.length
        : 50;

    return {
      name,
      display_name: displayName,
      initial_value: Math.round(initial_value * 100) / 100,
      enabled: true,
      color: COLUMN_COLORS[j % COLUMN_COLORS.length],
      icon: "",
    };
  });
}

const VALUE_MIN = 0;
const VALUE_MAX = 100;

/** Scale each column independently to 0–100 (min–max). Integers and floats accepted. */
export function normalizeCsvRowsTo0_100(rows: number[][]): number[][] {
  if (rows.length === 0) return rows;

  const columnCount = Math.max(...rows.map((r) => r.length), 0);
  const colMin = Array<number>(columnCount).fill(Infinity);
  const colMax = Array<number>(columnCount).fill(-Infinity);

  for (const row of rows) {
    for (let j = 0; j < row.length; j++) {
      const v = row[j];
      if (v < colMin[j]) colMin[j] = v;
      if (v > colMax[j]) colMax[j] = v;
    }
  }

  return rows.map((row) => {
    const out: number[] = [];
    for (let j = 0; j < columnCount; j++) {
      const v = j < row.length ? row[j] : 0;
      const lo = colMin[j];
      const hi = colMax[j];
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
        out.push(0);
        continue;
      }
      if (hi - lo < 1e-12) {
        out.push(Math.min(VALUE_MAX, Math.max(VALUE_MIN, v)));
      } else {
        const scaled = ((v - lo) / (hi - lo)) * VALUE_MAX;
        out.push(Math.min(VALUE_MAX, Math.max(VALUE_MIN, scaled)));
      }
    }
    return out;
  });
}

function columnRanges(rows: number[][]): { min: number; max: number }[] {
  const columnCount = Math.max(...rows.map((r) => r.length), 0);
  const ranges: { min: number; max: number }[] = [];
  for (let j = 0; j < columnCount; j++) {
    let min = Infinity;
    let max = -Infinity;
    for (const row of rows) {
      if (j < row.length) {
        min = Math.min(min, row[j]);
        max = Math.max(max, row[j]);
      }
    }
    ranges.push({
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
    });
  }
  return ranges;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseDataRow(cells: string[], columnCount: number): number[] | null {
  const values: number[] = [];
  for (let j = 0; j < columnCount; j++) {
    const cell = j < cells.length ? cells[j].trim() : "";
    if (cell === "") {
      values.push(0);
      continue;
    }
    const n = Number(cell);
    if (!Number.isFinite(n)) return null;
    values.push(n);
  }
  return values;
}

function looksLikeHeader(cells: string[]): boolean {
  if (cells.length === 0) return false;
  let numeric = 0;
  for (const cell of cells) {
    if (cell === "") continue;
    if (Number.isFinite(Number(cell))) numeric++;
  }
  return numeric < cells.filter((c) => c !== "").length / 2;
}

/** Parse CSV text into numeric rows (optional header row skipped). */
export function parseCsv(text: string): ParsedCsv {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const firstCells = splitCsvLine(lines[0]);
  const hasHeader = looksLikeHeader(firstCells);
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const headers = hasHeader ? firstCells : null;

  if (dataLines.length === 0) {
    throw new Error("CSV has no data rows.");
  }

  const columnCount = hasHeader
    ? firstCells.length
    : Math.max(...dataLines.map((l) => splitCsvLine(l).length), 1);

  const rows: number[][] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const cells = splitCsvLine(dataLines[i]);
    const row = parseDataRow(cells, columnCount);
    if (!row) {
      const lineNum = hasHeader ? i + 2 : i + 1;
      throw new Error(`Row ${lineNum} contains non-numeric values.`);
    }
    rows.push(row);
  }

  const rawColumnRanges = columnRanges(rows);
  const normalizedRows = normalizeCsvRowsTo0_100(rows);

  return {
    rows: normalizedRows,
    headers,
    rowCount: normalizedRows.length,
    columnCount,
    rawColumnRanges,
  };
}
