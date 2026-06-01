import { supabase } from "./supabase";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export interface ImportSummary {
  data_files: number;
  photo_files: number;
  skipped: number;
}

/** Upload an OLMDBManager export zip to the server for extraction. */
export async function importExportZip(file: File): Promise<ImportSummary> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/api/admin/import-export`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.error ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }

  const body = (await res.json()) as { summary: ImportSummary };
  return body.summary;
}
