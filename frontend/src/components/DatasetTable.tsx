import { Link } from 'react-router-dom';
import type { DatasetSummary } from '../types';
import { formatRelative, scoreColor } from '../lib/format';
import { SensitivityChip } from './SensitivityChip';

interface Props {
  datasets: DatasetSummary[];
}

function ScorePill({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${scoreColor(
        score,
      )}`}
    >
      {score.toFixed(0)}
    </span>
  );
}

export function DatasetTable({ datasets }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3">Dataset</th>
            <th className="px-4 py-3">Rows × Cols</th>
            <th className="px-4 py-3">Sensitivity</th>
            <th className="px-4 py-3 text-center">Quality</th>
            <th className="px-4 py-3 text-center">Trust</th>
            <th className="px-4 py-3 text-center">Value</th>
            <th className="px-4 py-3 text-center">Views</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {datasets.map((d) => (
            <tr key={d.id} className="transition hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link
                  to={`/datasets/${d.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {d.originalName}
                </Link>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="uppercase">{d.fileType}</span>
                  <span>·</span>
                  <span>uploaded {formatRelative(d.uploadedAt)}</span>
                  {d.lowActivity && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
                      low activity
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                {d.rowCount.toLocaleString()} × {d.columnCount}
                {d.duplicateRowCount > 0 && (
                  <div className="text-xs text-rose-500">
                    {d.duplicateRowCount} dup rows
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex max-w-52 flex-wrap gap-1">
                  {d.sensitiveTags.length === 0 ? (
                    <span className="text-xs text-slate-400">none</span>
                  ) : (
                    d.sensitiveTags.map((t) => (
                      <SensitivityChip key={t} tag={t} />
                    ))
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                <ScorePill score={d.qualityScore} />
              </td>
              <td className="px-4 py-3 text-center">
                <ScorePill score={d.trustScore} />
              </td>
              <td className="px-4 py-3 text-center">
                <ScorePill score={d.valueScore} />
              </td>
              <td className="px-4 py-3 text-center text-slate-600">
                {d.viewCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
