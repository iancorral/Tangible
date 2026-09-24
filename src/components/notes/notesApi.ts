import type { NoteDTO, NoteInput } from "@/lib/notes";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "No se pudo guardar la nota");
  }
  return data as T;
}

export function listNotes(params: { view: "active" | "archived"; q?: string }) {
  const search = new URLSearchParams({ view: params.view });
  if (params.q) search.set("q", params.q);
  return request<{ notes: NoteDTO[] }>(`/api/admin/notes?${search}`).then((d) => d.notes);
}

/** Notas con fecha entre dos días de Chihuahua (YYYY-MM-DD, inclusive). */
export function listNotesInRange(from: string, to: string) {
  const search = new URLSearchParams({ from, to });
  return request<{ notes: NoteDTO[] }>(`/api/admin/notes?${search}`).then((d) => d.notes);
}

export function createNote(input: NoteInput) {
  return request<NoteDTO>("/api/admin/notes", { method: "POST", body: JSON.stringify(input) });
}

export function updateNote(id: string, patch: NoteInput) {
  return request<NoteDTO>(`/api/admin/notes/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteNote(id: string) {
  return request<{ ok: true }>(`/api/admin/notes/${id}`, { method: "DELETE" });
}

export function newItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
