import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ParsingService } from '../parsing/parsing.service';
import { ProfilingService } from '../profiling/profiling.service';
import { ColumnStat, ScoringService } from '../scoring/scoring.service';
import { PrismaService } from '../prisma/prisma.service';
import { SensitivityTag } from '../generated/prisma/enums';
import type { Column, Dataset } from '../generated/prisma/client';

@Injectable()
export class DatasetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parsing: ParsingService,
    private readonly profiling: ProfilingService,
    private readonly scoring: ScoringService,
  ) {}

  /**
   * Full ingestion pipeline: parse → discover/profile → classify → score →
   * persist. Runs as a single nested create so a dataset and its columns are
   * written atomically.
   */
  async createFromUpload(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }

    const parsed = this.parsing.parse(file.buffer, file.originalname);
    if (parsed.headers.length === 0) {
      throw new BadRequestException('No columns were found in the file.');
    }

    const profile = this.profiling.profile(parsed);

    const stats: ColumnStat[] = profile.columns.map((c) => ({
      missingPct: c.missingPct,
      invalidPct: c.invalidPct,
      effectiveTag: c.autoTag,
      tagOverridden: false,
    }));

    const qualityScore = this.scoring.computeQuality(
      stats,
      profile.duplicateRowCount,
      parsed.rows.length,
    );
    const trustScore = this.scoring.computeTrust(
      stats,
      profile.duplicateRowCount,
      parsed.rows.length,
    );

    const dataset = await this.prisma.dataset.create({
      data: {
        filename: file.originalname,
        originalName: file.originalname,
        fileType: this.parsing.fileType(file.originalname),
        rowCount: parsed.rows.length,
        columnCount: parsed.headers.length,
        duplicateRowCount: profile.duplicateRowCount,
        qualityScore,
        trustScore,
        valueScore: 0,
        sampleRows: profile.sampleRows,
        columns: {
          create: profile.columns.map((c) => ({
            name: c.name,
            orderIndex: c.orderIndex,
            inferredType: c.inferredType,
            missingCount: c.missingCount,
            missingPct: c.missingPct,
            distinctCount: c.distinctCount,
            invalidCount: c.invalidCount,
            invalidPct: c.invalidPct,
            autoTag: c.autoTag,
          })),
        },
      },
      include: { columns: { orderBy: { orderIndex: 'asc' } } },
    });

    return this.decorate(dataset);
  }

  /** List datasets (newest first) for the dashboard. */
  async findAll() {
    const datasets = await this.prisma.dataset.findMany({
      orderBy: { uploadedAt: 'desc' },
      include: {
        columns: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { columns: true } },
      },
    });
    return datasets.map((d) => this.summarize(d));
  }

  /**
   * Fetch one dataset and record a view. Viewing is what drives the Value
   * score, so we log a UsageEvent, bump the counter, and recompute value.
   */
  async findOne(id: string) {
    const existing = await this.prisma.dataset.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Dataset ${id} not found.`);
    }

    const now = new Date();
    const viewCount = existing.viewCount + 1;
    const valueScore = this.scoring.computeValue(viewCount, now, now);

    await this.prisma.$transaction([
      this.prisma.usageEvent.create({
        data: { datasetId: id, type: 'VIEW' },
      }),
      this.prisma.dataset.update({
        where: { id },
        data: { viewCount, lastAccessedAt: now, valueScore },
      }),
    ]);

    const dataset = await this.prisma.dataset.findUniqueOrThrow({
      where: { id },
      include: { columns: { orderBy: { orderIndex: 'asc' } } },
    });
    return this.decorate(dataset);
  }

  /** Manually override (or clear) a column's sensitivity tag; recompute trust. */
  async updateColumnTag(
    datasetId: string,
    columnId: string,
    manualTag: SensitivityTag | null | undefined,
  ) {
    const column = await this.prisma.column.findFirst({
      where: { id: columnId, datasetId },
    });
    if (!column) {
      throw new NotFoundException(
        `Column ${columnId} not found in dataset ${datasetId}.`,
      );
    }

    const clearing = manualTag === null || manualTag === undefined;
    await this.prisma.column.update({
      where: { id: columnId },
      data: {
        manualTag: clearing ? null : manualTag,
        tagOverridden: !clearing,
      },
    });

    await this.recomputeTrust(datasetId);

    const dataset = await this.prisma.dataset.findUniqueOrThrow({
      where: { id: datasetId },
      include: { columns: { orderBy: { orderIndex: 'asc' } } },
    });
    return this.decorate(dataset);
  }

  async remove(id: string) {
    const existing = await this.prisma.dataset.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Dataset ${id} not found.`);
    }
    await this.prisma.dataset.delete({ where: { id } });
    return { deleted: true, id };
  }

  /**
   * Recompute quality + trust from the currently stored columns. Called after a
   * manual tag override, which can change classification coverage. Column-level
   * invalid counts are not re-derived (raw values aren't persisted) — a
   * documented trade-off.
   */
  private async recomputeTrust(datasetId: string) {
    const dataset = await this.prisma.dataset.findUniqueOrThrow({
      where: { id: datasetId },
      include: { columns: true },
    });

    const stats: ColumnStat[] = dataset.columns.map((c) => ({
      missingPct: c.missingPct,
      invalidPct: c.invalidPct,
      effectiveTag: c.manualTag ?? c.autoTag,
      tagOverridden: c.tagOverridden,
    }));

    const trustScore = this.scoring.computeTrust(
      stats,
      dataset.duplicateRowCount,
      dataset.rowCount,
    );

    await this.prisma.dataset.update({
      where: { id: datasetId },
      data: { trustScore },
    });
  }

  /** Attach derived fields (effective tag, low-activity flag) for the API. */
  private decorate(dataset: Dataset & { columns: Column[] }) {
    return {
      ...dataset,
      lowActivity: this.scoring.isLowActivity(dataset.valueScore),
      columns: dataset.columns.map((c) => ({
        ...c,
        effectiveTag: c.manualTag ?? c.autoTag,
      })),
    };
  }

  /** Lighter shape for the list view (no sample rows / column internals). */
  private summarize(
    dataset: Dataset & {
      columns: Column[];
      _count: { columns: number };
    },
  ) {
    const sensitiveTags = Array.from(
      new Set(
        dataset.columns
          .map((c) => c.manualTag ?? c.autoTag)
          .filter((t) => t !== SensitivityTag.NONE),
      ),
    );

    return {
      id: dataset.id,
      originalName: dataset.originalName,
      fileType: dataset.fileType,
      uploadedAt: dataset.uploadedAt,
      rowCount: dataset.rowCount,
      columnCount: dataset.columnCount,
      duplicateRowCount: dataset.duplicateRowCount,
      qualityScore: dataset.qualityScore,
      trustScore: dataset.trustScore,
      valueScore: dataset.valueScore,
      viewCount: dataset.viewCount,
      lastAccessedAt: dataset.lastAccessedAt,
      lowActivity: this.scoring.isLowActivity(dataset.valueScore),
      sensitiveTags,
    };
  }
}
