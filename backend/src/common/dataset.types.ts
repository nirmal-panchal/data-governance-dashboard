import { ColumnType, SensitivityTag } from '../generated/prisma/enums';

/** Raw tabular data after parsing a CSV/Excel file. */
export interface ParsedDataset {
  /** Column headers, de-duplicated and never blank. */
  headers: string[];
  /** Each row is an array of cell strings aligned positionally to `headers`. */
  rows: string[][];
}

/** Per-column profile produced by discovery + quality checks. */
export interface ColumnProfile {
  name: string;
  orderIndex: number;
  inferredType: ColumnType;
  missingCount: number;
  missingPct: number;
  distinctCount: number;
  invalidCount: number;
  invalidPct: number;
  autoTag: SensitivityTag;
}

/** Dataset-level profile aggregating all columns. */
export interface DatasetProfile {
  columns: ColumnProfile[];
  duplicateRowCount: number;
  sampleRows: Record<string, string>[];
}
