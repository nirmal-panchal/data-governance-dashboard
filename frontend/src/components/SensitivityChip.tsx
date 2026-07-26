import type { SensitivityTag } from '../types';
import { tagColor, tagLabel } from '../lib/format';

interface Props {
  tag: SensitivityTag;
  overridden?: boolean;
}

/** Colored chip for a column's sensitivity classification. */
export function SensitivityChip({ tag, overridden }: Props) {
  if (tag === 'NONE' && !overridden) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${tagColor(
        tag,
      )}`}
    >
      {tagLabel(tag)}
      {overridden && (
        <span title="Manually overridden" className="text-[10px]">
          ✎
        </span>
      )}
    </span>
  );
}
