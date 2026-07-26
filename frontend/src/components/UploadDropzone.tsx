import { useRef, useState } from 'react';
import { api } from '../api/client';
import type { DatasetDetail } from '../types';

interface Props {
  onUploaded: (dataset: DatasetDetail) => void;
}

/** Drag-and-drop / click-to-browse uploader for CSV & Excel files. */
export function UploadDropzone({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dataset = await api.uploadDataset(file);
      onUploaded(dataset);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <div className="text-3xl">{uploading ? '⏳' : '📤'}</div>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {uploading
            ? 'Analyzing dataset…'
            : 'Drop a CSV or Excel file here, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          We profile structure, classify sensitive fields, and score quality on
          upload.
        </p>
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
