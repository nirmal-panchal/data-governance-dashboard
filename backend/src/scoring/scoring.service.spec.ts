import { ColumnStat, ScoringService } from './scoring.service';
import { SensitivityTag } from '../generated/prisma/enums';

function col(overrides: Partial<ColumnStat> = {}): ColumnStat {
  return {
    missingPct: 0,
    invalidPct: 0,
    effectiveTag: SensitivityTag.NONE,
    tagOverridden: false,
    ...overrides,
  };
}

describe('ScoringService', () => {
  const service = new ScoringService();

  describe('computeQuality', () => {
    it('scores clean, unique data at 100', () => {
      const cols = [col(), col()];
      expect(service.computeQuality(cols, 0, 100)).toBe(100);
    });

    it('penalizes missing, invalid, and duplicate data', () => {
      const cols = [col({ missingPct: 50 }), col({ invalidPct: 50 })];
      const score = service.computeQuality(cols, 20, 100); // 20% dup rows
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('handles an empty dataset without dividing by zero', () => {
      expect(service.computeQuality([], 0, 0)).toBe(100);
    });
  });

  describe('computeTrust', () => {
    it('rises as more columns are classified', () => {
      const unclassified = [col(), col()];
      const classified = [
        col({ effectiveTag: SensitivityTag.EMAIL }),
        col({ effectiveTag: SensitivityTag.NAME }),
      ];
      expect(service.computeTrust(classified, 0, 100)).toBeGreaterThan(
        service.computeTrust(unclassified, 0, 100),
      );
    });

    it('counts a human override toward classification coverage', () => {
      const reviewed = [col({ tagOverridden: true })];
      const notReviewed = [col()];
      expect(service.computeTrust(reviewed, 0, 100)).toBeGreaterThan(
        service.computeTrust(notReviewed, 0, 100),
      );
    });
  });

  describe('computeValue', () => {
    it('is 0 for a never-viewed dataset', () => {
      expect(service.computeValue(0, null)).toBe(0);
    });

    it('increases with view count', () => {
      const now = new Date('2026-01-10T00:00:00Z');
      const few = service.computeValue(1, now, now);
      const many = service.computeValue(40, now, now);
      expect(many).toBeGreaterThan(few);
    });

    it('decays as last access grows stale', () => {
      const now = new Date('2026-02-01T00:00:00Z');
      const fresh = new Date('2026-01-31T00:00:00Z'); // 1 day old
      const stale = new Date('2025-12-01T00:00:00Z'); // ~60 days old
      expect(service.computeValue(10, fresh, now)).toBeGreaterThan(
        service.computeValue(10, stale, now),
      );
    });

    it('flags low-activity datasets', () => {
      expect(service.isLowActivity(service.computeValue(0, null))).toBe(true);
    });
  });
});
