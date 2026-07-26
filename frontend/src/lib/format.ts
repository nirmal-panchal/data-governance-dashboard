import type { SensitivityTag } from '../types';

/** Tailwind classes for a 0-100 score, green→amber→red. */
export function scoreColor(score: number): string {
  if (score >= 75) return 'bg-emerald-100 text-emerald-800 ring-emerald-600/20';
  if (score >= 50) return 'bg-amber-100 text-amber-800 ring-amber-600/20';
  return 'bg-rose-100 text-rose-800 ring-rose-600/20';
}

/** Distinct colors per sensitivity tag. */
export function tagColor(tag: SensitivityTag): string {
  switch (tag) {
    case 'EMAIL':
      return 'bg-blue-100 text-blue-800';
    case 'PHONE':
      return 'bg-indigo-100 text-indigo-800';
    case 'NAME':
      return 'bg-purple-100 text-purple-800';
    case 'ID':
      return 'bg-fuchsia-100 text-fuchsia-800';
    case 'CREDIT_CARD':
      return 'bg-red-100 text-red-800';
    case 'ADDRESS':
      return 'bg-teal-100 text-teal-800';
    case 'DATE':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-500';
  }
}

export function tagLabel(tag: SensitivityTag): string {
  return tag === 'CREDIT_CARD' ? 'Credit Card' : titleCase(tag);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, sep, c: string) =>
      (sep ? ' ' : '') + c.toUpperCase(),
    )
    .trim();
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
