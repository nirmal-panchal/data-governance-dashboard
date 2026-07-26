import { BadRequestException, Injectable } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { ParsedDataset } from '../common/dataset.types';

/**
 * Turns an uploaded CSV or Excel buffer into a normalized { headers, rows }
 * structure. Handles the messy realities the brief calls out: empty files,
 * blank headers, and duplicate column names.
 */
@Injectable()
export class ParsingService {
  /** Detect kind from extension/mimetype and parse accordingly. */
  parse(buffer: Buffer, originalName: string): ParsedDataset {
    const ext = originalName.toLowerCase().split('.').pop() ?? '';

    let grid: string[][];
    if (ext === 'csv' || ext === 'txt') {
      grid = this.parseCsvBuffer(buffer);
    } else if (ext === 'xlsx' || ext === 'xls') {
      grid = this.parseExcelBuffer(buffer);
    } else {
      throw new BadRequestException(
        `Unsupported file type ".${ext}". Please upload a .csv or .xlsx file.`,
      );
    }

    if (grid.length === 0) {
      throw new BadRequestException('The uploaded file appears to be empty.');
    }

    const [rawHeaders, ...rawRows] = grid;
    const headers = this.dedupeHeaders(rawHeaders);

    // Normalize each row to exactly headers.length cells.
    const rows = rawRows
      .map((row) => this.normalizeRow(row, headers.length))
      // Drop fully-empty rows (common trailing artifact in CSV/Excel exports).
      .filter((row) => row.some((cell) => cell !== ''));

    return { headers, rows };
  }

  /** File type label stored on the dataset. */
  fileType(originalName: string): string {
    const ext = originalName.toLowerCase().split('.').pop() ?? '';
    return ext === 'csv' || ext === 'txt' ? 'csv' : 'xlsx';
  }

  private parseCsvBuffer(buffer: Buffer): string[][] {
    try {
      return parseCsv(buffer, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true, // tolerate ragged rows
        trim: true,
      });
    } catch (err) {
      throw new BadRequestException(
        `Could not parse CSV file: ${(err as Error).message}`,
      );
    }
  }

  private parseExcelBuffer(buffer: Buffer): string[][] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return [];
      const sheet = workbook.Sheets[firstSheetName];
      const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        raw: false, // format everything as strings
        defval: '',
        blankrows: false,
      });
      return grid.map((row) => row.map((cell) => String(cell ?? '').trim()));
    } catch (err) {
      throw new BadRequestException(
        `Could not parse Excel file: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Ensures every header is non-blank and unique. Blank headers become
   * `column_N`; duplicates get a numeric suffix (`email`, `email_2`, ...).
   */
  private dedupeHeaders(raw: string[]): string[] {
    const seen = new Map<string, number>();
    return raw.map((h, i) => {
      let name = (h ?? '').toString().trim();
      if (name === '') name = `column_${i + 1}`;

      const count = seen.get(name) ?? 0;
      seen.set(name, count + 1);
      return count === 0 ? name : `${name}_${count + 1}`;
    });
  }

  private normalizeRow(row: string[], width: number): string[] {
    const out = new Array<string>(width);
    for (let i = 0; i < width; i++) {
      out[i] = (row[i] ?? '').toString().trim();
    }
    return out;
  }
}
