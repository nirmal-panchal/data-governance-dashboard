import { useState } from 'react';
import type { ColumnDetail, SensitivityTag } from '../types';
import { tagLabel } from '../lib/format';

const TAGS: SensitivityTag[] = [
  'EMAIL',
  'PHONE',
  'NAME',
  'ID',
  'CREDIT_CARD',
  'ADDRESS',
  'DATE',
  'NONE',
];

const AUTO = '__AUTO__';

interface Props {
  column: ColumnDetail;
  onChange: (manualTag: SensitivityTag | null) => Promise<void>;
}

/** Dropdown to manually override a column's tag, or reset it to auto-detected. */
export function TagSelect({ column, onChange }: Props) {
  const [saving, setSaving] = useState(false);

  const value = column.tagOverridden ? column.manualTag ?? 'NONE' : AUTO;

  async function handle(next: string) {
    setSaving(true);
    try {
      await onChange(next === AUTO ? null : (next as SensitivityTag));
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={value}
      disabled={saving}
      onChange={(e) => void handle(e.target.value)}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none disabled:opacity-50"
      title="Override the auto-detected classification"
    >
      <option value={AUTO}>Auto ({tagLabel(column.autoTag)})</option>
      {TAGS.map((t) => (
        <option key={t} value={t}>
          {tagLabel(t)}
        </option>
      ))}
    </select>
  );
}
