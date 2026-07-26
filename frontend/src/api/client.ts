import type {
  DatasetDetail,
  DatasetSummary,
  SensitivityTag,
} from '../types';

const BASE_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
      }
    } catch {
      // response had no JSON body; keep the default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listDatasets: () => request<DatasetSummary[]>('/datasets'),

  getDataset: (id: string) => request<DatasetDetail>(`/datasets/${id}`),

  uploadDataset: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<DatasetDetail>('/datasets/upload', {
      method: 'POST',
      body: form,
    });
  },

  updateColumnTag: (
    datasetId: string,
    columnId: string,
    manualTag: SensitivityTag | null,
  ) =>
    request<DatasetDetail>(`/datasets/${datasetId}/columns/${columnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualTag }),
    }),

  deleteDataset: (id: string) =>
    request<{ deleted: boolean }>(`/datasets/${id}`, { method: 'DELETE' }),
};
