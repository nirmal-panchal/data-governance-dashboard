import { Injectable } from '@nestjs/common';
import { SensitivityTag } from '../generated/prisma/enums';

/** Minimal per-column stats the scoring formulas depend on. */
export interface ColumnStat {
  missingPct: number; // 0-100
  invalidPct: number; // 0-100
  effectiveTag: SensitivityTag; // manualTag ?? autoTag
  tagOverridden: boolean;
}

/** Views beyond this saturate the usage component of the value score. */
const VALUE_SATURATION_VIEWS = 50;
const RECENCY_FRESH_DAYS = 7;
const RECENCY_STALE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Datasets scoring at/below this are surfaced as low-activity in the UI. */
export const LOW_ACTIVITY_THRESHOLD = 15;

@Injectable()
export class ScoringService {
  /**
   * Quality — how clean the data is. Weighted blend of completeness (few
   * missing values), validity (few invalid values), and uniqueness (few
   * duplicate rows). Returns 0-100.
   */
  computeQuality(
    columns: ColumnStat[],
    duplicateRowCount: number,
    rowCount: number,
  ): number {
    const completeness = 1 - this.avg(columns.map((c) => c.missingPct)) / 100;
    const validity = 1 - this.avg(columns.map((c) => c.invalidPct)) / 100;
    const uniqueness = rowCount > 0 ? 1 - duplicateRowCount / rowCount : 1;

    const score = 0.4 * completeness + 0.3 * validity + 0.3 * uniqueness;
    return this.to100(score);
  }

  /**
   * Trust — how reliable the dataset is. Combines quality with completeness,
   * accuracy, consistency, and how completely it's been classified (the brief's
   * five factors). Human-reviewed (overridden) tags boost classification
   * coverage. Returns 0-100.
   */
  computeTrust(
    columns: ColumnStat[],
    duplicateRowCount: number,
    rowCount: number,
  ): number {
    const quality =
      this.computeQuality(columns, duplicateRowCount, rowCount) / 100;
    const completeness = 1 - this.avg(columns.map((c) => c.missingPct)) / 100;
    const accuracy = 1 - this.avg(columns.map((c) => c.invalidPct)) / 100;
    const consistency = rowCount > 0 ? 1 - duplicateRowCount / rowCount : 1;
    const classificationCoverage = this.coverage(columns);

    const score =
      0.35 * quality +
      0.25 * completeness +
      0.2 * accuracy +
      0.1 * consistency +
      0.1 * classificationCoverage;
    return this.to100(score);
  }

  /**
   * Value — how much the dataset is actually used. Blends usage volume
   * (saturating log of view count) with recency of last access. A dataset with
   * no views scores 0. Returns 0-100.
   */
  computeValue(
    viewCount: number,
    lastAccessedAt: Date | null,
    now: Date = new Date(),
  ): number {
    const usage =
      Math.log10(viewCount + 1) / Math.log10(VALUE_SATURATION_VIEWS + 1);
    const usageComponent = Math.min(1, usage);

    const recencyComponent = this.recency(lastAccessedAt, now);

    const score = 0.7 * usageComponent + 0.3 * recencyComponent;
    return this.to100(score);
  }

  isLowActivity(valueScore: number): boolean {
    return valueScore <= LOW_ACTIVITY_THRESHOLD;
  }

  /** Fraction of columns that are a known sensitive type or human-reviewed. */
  private coverage(columns: ColumnStat[]): number {
    if (columns.length === 0) return 0;
    const classified = columns.filter(
      (c) => c.effectiveTag !== SensitivityTag.NONE || c.tagOverridden,
    ).length;
    return classified / columns.length;
  }

  private recency(lastAccessedAt: Date | null, now: Date): number {
    if (!lastAccessedAt) return 0;
    const ageDays = (now.getTime() - lastAccessedAt.getTime()) / DAY_MS;
    if (ageDays <= RECENCY_FRESH_DAYS) return 1;
    if (ageDays >= RECENCY_STALE_DAYS) return 0;
    // Linear decay between fresh and stale.
    return (
      1 -
      (ageDays - RECENCY_FRESH_DAYS) / (RECENCY_STALE_DAYS - RECENCY_FRESH_DAYS)
    );
  }

  private avg(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  private to100(fraction: number): number {
    const clamped = Math.max(0, Math.min(1, fraction));
    return Math.round(clamped * 1000) / 10; // one decimal place, 0-100
  }
}
