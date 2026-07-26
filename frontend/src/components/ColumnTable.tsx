import type { ColumnDetail, SensitivityTag } from '../types';
import { titleCase } from '../lib/format';
import { SensitivityChip } from './SensitivityChip';
import { TagSelect } from './TagSelect';

interface Props {
  columns: ColumnDetail[];
  onTagChange: (
    columnId: string,
    manualTag: SensitivityTag | null,
  ) => Promise<void>;
}

/** Highlight a percentage cell red as the value worsens. */
function pctClass(pct: number): string {
  if (pct === 0) return 'text-slate-500';
  if (pct < 10) return 'text-amber-600';
  return 'text-rose-600 font-medium';
}

export function ColumnTable({ columns, onTagChange }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3">Column</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right">Missing</th>
            <th className="px-4 py-3 text-right">Invalid</th>
            <th className="px-4 py-3 text-right">Distinct</th>
            <th className="px-4 py-3">Classification</th>
            <th className="px-4 py-3">Override</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {columns.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800">
                {c.name}
              </td>
              <td className="px-4 py-3">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                  {titleCase(c.inferredType)}
                </span>
              </td>
              <td className={`px-4 py-3 text-right ${pctClass(c.missingPct)}`}>
                {c.missingPct}%
                <span className="ml-1 text-xs text-slate-400">
                  ({c.missingCount})
                </span>
              </td>
              <td className={`px-4 py-3 text-right ${pctClass(c.invalidPct)}`}>
                {c.invalidPct}%
                <span className="ml-1 text-xs text-slate-400">
                  ({c.invalidCount})
                </span>
              </td>
              <td className="px-4 py-3 text-right text-slate-600">
                {c.distinctCount}
              </td>
              <td className="px-4 py-3">
                <SensitivityChip
                  tag={c.effectiveTag}
                  overridden={c.tagOverridden}
                />
              </td>
              <td className="px-4 py-3">
                <TagSelect
                  column={c}
                  onChange={(tag) => onTagChange(c.id, tag)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
