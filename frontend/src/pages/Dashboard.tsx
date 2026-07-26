import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { DatasetSummary } from '../types';
import { DatasetTable } from '../components/DatasetTable';
import { UploadDropzone } from '../components/UploadDropzone';

export function Dashboard() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setDatasets(await api.listDatasets());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold text-slate-800">
          Upload a dataset
        </h2>
        <UploadDropzone onUploaded={() => void load()} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Catalog{' '}
            <span className="text-sm font-normal text-slate-400">
              ({datasets.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">
            Loading catalog…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
            Could not reach the API: {error}
            <div className="mt-1 text-xs text-rose-500">
              If this is a free-tier backend, it may be waking up — retry in
              ~30s.
            </div>
          </div>
        ) : datasets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No datasets yet. Upload a CSV or Excel file to get started.
          </div>
        ) : (
          <DatasetTable datasets={datasets} />
        )}
      </section>
    </div>
  );
}
