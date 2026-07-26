import { scoreColor } from '../lib/format';

interface Props {
  label: string;
  score: number;
  title?: string;
}

/** A compact pill showing a governance score (0-100), color-coded by level. */
export function ScoreBadge({ label, score, title }: Props) {
  return (
    <div className="flex flex-col items-center gap-1" title={title}>
      <span
        className={`inline-flex min-w-14 items-center justify-center rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ring-inset ${scoreColor(
          score,
        )}`}
      >
        {score.toFixed(0)}
      </span>
      <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </span>
    </div>
  );
}
