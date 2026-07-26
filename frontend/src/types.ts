export type SensitivityTag =
  | 'EMAIL'
  | 'PHONE'
  | 'NAME'
  | 'ID'
  | 'CREDIT_CARD'
  | 'ADDRESS'
  | 'DATE'
  | 'NONE';

export type ColumnType =
  | 'INTEGER'
  | 'FLOAT'
  | 'BOOLEAN'
  | 'DATE'
  | 'STRING';

export interface DatasetSummary {
  id: string;
  originalName: string;
  fileType: string;
  uploadedAt: string;
  rowCount: number;
  columnCount: number;
  duplicateRowCount: number;
  qualityScore: number;
  trustScore: number;
  valueScore: number;
  viewCount: number;
  lastAccessedAt: string | null;
  lowActivity: boolean;
  sensitiveTags: SensitivityTag[];
}

export interface ColumnDetail {
  id: string;
  name: string;
  orderIndex: number;
  inferredType: ColumnType;
  missingCount: number;
  missingPct: number;
  distinctCount: number;
  invalidCount: number;
  invalidPct: number;
  autoTag: SensitivityTag;
  manualTag: SensitivityTag | null;
  tagOverridden: boolean;
  effectiveTag: SensitivityTag;
}

export interface DatasetDetail {
  id: string;
  originalName: string;
  fileType: string;
  uploadedAt: string;
  rowCount: number;
  columnCount: number;
  duplicateRowCount: number;
  qualityScore: number;
  trustScore: number;
  valueScore: number;
  viewCount: number;
  lastAccessedAt: string | null;
  lowActivity: boolean;
  sampleRows: Record<string, string>[] | null;
  columns: ColumnDetail[];
}
