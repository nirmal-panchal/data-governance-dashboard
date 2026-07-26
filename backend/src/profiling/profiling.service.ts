import { Injectable } from '@nestjs/common';
import { ClassificationService } from '../classification/classification.service';
import {
  ColumnProfile,
  DatasetProfile,
  ParsedDataset,
} from '../common/dataset.types';
import { ColumnType, SensitivityTag } from '../generated/prisma/enums';

/** Share of non-missing values that must agree for a type to be inferred. */
const TYPE_THRESHOLD = 0.6;
const SAMPLE_ROW_LIMIT = 10;

@Injectable()
export class ProfilingService {
  constructor(private readonly classification: ClassificationService) {}

  /**
   * Runs discovery (types), classification, and quality checks over the whole
   * dataset, returning per-column profiles plus dataset-level aggregates.
   */
  profile(parsed: ParsedDataset): DatasetProfile {
    const { headers, rows } = parsed;

    const columns = headers.map((name, colIdx) => {
      const values = rows.map((row) => row[colIdx] ?? '');
      return this.profileColumn(name, colIdx, values, rows.length);
    });

    return {
      columns,
      duplicateRowCount: this.countDuplicateRows(rows),
      sampleRows: this.buildSampleRows(headers, rows),
    };
  }

  private profileColumn(
    name: string,
    orderIndex: number,
    values: string[],
    rowCount: number,
  ): ColumnProfile {
    const nonMissing = values.filter((v) => v !== '');
    const missingCount = rowCount - nonMissing.length;
    const distinctCount = new Set(nonMissing).size;

    const inferredType = this.inferType(nonMissing);
    const autoTag = this.classification.classifyColumn(name, values);
    const invalidCount = this.countInvalid(nonMissing, inferredType, autoTag);

    return {
      name,
      orderIndex,
      inferredType,
      missingCount,
      missingPct: this.pct(missingCount, rowCount),
      distinctCount,
      invalidCount,
      invalidPct: this.pct(invalidCount, rowCount),
      autoTag,
    };
  }

  /** Dominant-type inference tolerant of a few off-type values. */
  private inferType(values: string[]): ColumnType {
    if (values.length === 0) return ColumnType.STRING;

    let bool = 0;
    let int = 0;
    let float = 0;
    let date = 0;
    for (const v of values) {
      if (this.isBoolean(v)) bool++;
      else if (this.isInteger(v)) int++;
      else if (this.isNumber(v)) float++;
      else if (this.isDate(v)) date++;
    }

    const total = values.length;
    const numeric = int + float;
    const buckets: Array<[ColumnType, number]> = [
      [ColumnType.BOOLEAN, bool],
      // Numeric collapsed; refined below to INTEGER vs FLOAT.
      [
        numeric >= 1 && float > 0 ? ColumnType.FLOAT : ColumnType.INTEGER,
        numeric,
      ],
      [ColumnType.DATE, date],
    ];

    let best: ColumnType = ColumnType.STRING;
    let bestCount = 0;
    for (const [type, count] of buckets) {
      if (count > bestCount) {
        best = type;
        bestCount = count;
      }
    }

    return bestCount / total >= TYPE_THRESHOLD ? best : ColumnType.STRING;
  }

  /** Count "obviously invalid" values: format violations, then type mismatches. */
  private countInvalid(
    values: string[],
    type: ColumnType,
    tag: SensitivityTag,
  ): number {
    // Format-based tags (email/phone/card) get precedence — a malformed email
    // is invalid regardless of the string type inference.
    if (
      tag === SensitivityTag.EMAIL ||
      tag === SensitivityTag.PHONE ||
      tag === SensitivityTag.CREDIT_CARD
    ) {
      return values.filter((v) => !this.classification.isValidForTag(tag, v))
        .length;
    }

    switch (type) {
      case ColumnType.BOOLEAN:
        return values.filter((v) => !this.isBoolean(v)).length;
      case ColumnType.INTEGER:
        return values.filter((v) => !this.isInteger(v)).length;
      case ColumnType.FLOAT:
        return values.filter((v) => !this.isNumber(v)).length;
      case ColumnType.DATE:
        return values.filter((v) => !this.isDate(v)).length;
      default:
        // Free-text string columns have no strict validity constraint.
        return 0;
    }
  }

  private countDuplicateRows(rows: string[][]): number {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const row of rows) {
      const key = row.join('');
      if (seen.has(key)) duplicates++;
      else seen.add(key);
    }
    return duplicates;
  }

  private buildSampleRows(
    headers: string[],
    rows: string[][],
  ): Record<string, string>[] {
    return rows.slice(0, SAMPLE_ROW_LIMIT).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = row[i] ?? ''));
      return obj;
    });
  }

  private pct(part: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((part / total) * 10000) / 100; // 2 decimal places
  }

  private isBoolean(v: string): boolean {
    return /^(true|false|yes|no)$/i.test(v);
  }

  private isInteger(v: string): boolean {
    return /^-?\d+$/.test(v);
  }

  private isNumber(v: string): boolean {
    return /^-?\d*\.?\d+$/.test(v) && !Number.isNaN(Number(v));
  }

  private isDate(v: string): boolean {
    if (!/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(v)) return false;
    return !Number.isNaN(Date.parse(v));
  }
}
