import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Tiny ComfyUI API client (HTTP only): upload an input image, queue a workflow in API format, wait for it, fetch
// the images it saved. ComfyUI must be running (C:\ComfyUI\python_embeded\python.exe -s ComfyUI\main.py).

const BASE = process.env.COMFY_URL ?? 'http://127.0.0.1:8188';
export type Workflow = Record<string, { class_type: string; inputs: Record<string, unknown> }>;
type Out = { filename: string; subfolder: string; type: string };

export async function upload(file: string, name: string): Promise<string> {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(await readFile(file))], { type: 'image/png' }), name);
  form.append('overwrite', 'true');
  const res = await fetch(`${BASE}/upload/image`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload ${name}: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { name: string }).name;
}

// Runs one workflow; returns the PNG bytes of every SaveImage node, by node id.
export async function run(flow: Workflow): Promise<Record<string, Uint8Array>> {
  const res = await fetch(`${BASE}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: flow }) });
  if (!res.ok) throw new Error(`queue: ${res.status} ${await res.text()}`);
  const { prompt_id } = (await res.json()) as { prompt_id: string };
  for (;;) {
    await new Promise((r) => setTimeout(r, 400));
    const hist = (await (await fetch(`${BASE}/history/${prompt_id}`)).json()) as Record<string, { status: { status_str: string }; outputs: Record<string, { images?: Out[] }> }>;
    const h = hist[prompt_id];
    if (!h) continue;
    if (h.status.status_str === 'error') throw new Error(`workflow failed: ${JSON.stringify(h.status)}`);
    const out: Record<string, Uint8Array> = {};
    for (const [id, o] of Object.entries(h.outputs)) {
      const img = o.images?.[0];
      if (!img) continue;
      const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
      out[id] = new Uint8Array(await (await fetch(`${BASE}/view?${q}`)).arrayBuffer());
    }
    return out;
  }
}

export const here = (...p: string[]) => path.resolve(import.meta.dirname, ...p);
