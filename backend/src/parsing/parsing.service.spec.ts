import { BadRequestException } from '@nestjs/common';
import { ParsingService } from './parsing.service';

const csv = (text: string) => Buffer.from(text, 'utf8');

describe('ParsingService', () => {
  const service = new ParsingService();

  it('parses a simple CSV into headers and rows', () => {
    const result = service.parse(csv('a,b\n1,2\n3,4\n'), 'data.csv');
    expect(result.headers).toEqual(['a', 'b']);
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('de-duplicates and back-fills blank/duplicate headers', () => {
    const result = service.parse(csv('a,b,a,\n1,2,3,4\n'), 'dupes.csv');
    expect(result.headers).toEqual(['a', 'b', 'a_2', 'column_4']);
  });

  it('drops fully-empty rows and normalizes ragged rows', () => {
    const result = service.parse(csv('a,b\n1\n\n2,3\n'), 'ragged.csv');
    expect(result.rows).toEqual([
      ['1', ''],
      ['2', '3'],
    ]);
  });

  it('rejects an empty file', () => {
    expect(() => service.parse(csv(''), 'empty.csv')).toThrow(
      BadRequestException,
    );
  });

  it('rejects unsupported file types', () => {
    expect(() => service.parse(csv('x'), 'notes.pdf')).toThrow(
      BadRequestException,
    );
  });
});
