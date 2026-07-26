import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { DatasetDetail as Detail, SensitivityTag } from '../types';
import { ScoreBadge } from '../components/ScoreBadge';
import { ColumnTable } from '../components/ColumnTable';
import { formatDate } from '../lib/format';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function SampleRows({ rows }: { rows: Record<string, string>[] }) {
  if (rows.length === 0) return null;
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-xs">
        <thead className="bg-slate-50 text-left font-semibold text-slate-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td
                  key={h}
                  className="max-w-48 truncate px-3 py-2 text-slate-600"
                  title={row[h]}
                >
                  {row[h] === '' ? (
                    <span className="text-slate-300">∅</span>
                  ) : (
                    row[h]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DatasetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .getDataset(id)
      .then(setDataset)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleTagChange(
    columnId: string,
    manualTag: SensitivityTag | null,
  ) {
    if (!id) return;
    const updated = await api.updateColumnTag(id, columnId, manualTag);
    setDataset(updated);
  }

  async function handleDelete() {
    if (!id || !confirm('Delete this dataset? This cannot be undone.')) return;
    await api.deleteDataset(id);
    navigate('/');
  }

  if (loading) {
    return <p className="text-slate-400">Loading dataset…</p>;
  }
  if (error || !dataset) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {error ?? 'Dataset not found.'}
        <div className="mt-2">
          <Link to="/" className="text-indigo-700 hover:underline">
            ← Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-indigo-700 hover:underline">
          ← Back to catalog
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {dataset.originalName}
            </h2>
            {dataset.lowActivity && (
              <span className="mt-1 inline-block rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Low activity — candidate for archival / retirement
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            <Stat label="Rows" value={dataset.rowCount.toLocaleString()} />
            <Stat label="Columns" value={dataset.columnCount} />
            <Stat label="Duplicate rows" value={dataset.duplicateRowCount} />
            <Stat label="File type" value={dataset.fileType.toUpperCase()} />
            <Stat label="Views" value={dataset.viewCount} />
            <Stat label="Uploaded" value={formatDate(dataset.uploadedAt)} />
          </dl>
        </div>
        <div className="flex flex-col items-end gap-4">
          <div className="flex gap-4">
            <ScoreBadge
              label="Quality"
              score={dataset.qualityScore}
              title="Completeness, validity, and uniqueness"
            />
            <ScoreBadge
              label="Trust"
              score={dataset.trustScore}
              title="Reliability from quality + classification coverage"
            />
            <ScoreBadge
              label="Value"
              score={dataset.valueScore}
              title="Usage volume and access recency"
            />
          </div>
          <button
            onClick={() => void handleDelete()}
            className="rounded-md border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50"
          >
            Delete dataset
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-lg font-semibold text-slate-800">
          Columns &amp; classification
        </h3>
        <ColumnTable
          columns={dataset.columns}
          onTagChange={handleTagChange}
        />
      </section>

      {dataset.sampleRows && dataset.sampleRows.length > 0 && (
        <section>
          <h3 className="mb-2 text-lg font-semibold text-slate-800">
            Sample rows{' '}
            <span className="text-sm font-normal text-slate-400">
              (first {dataset.sampleRows.length})
            </span>
          </h3>
          <SampleRows rows={dataset.sampleRows} />
        </section>
      )}
    </div>
  );
}
