/** D1 stores a single text value. Compress large logs without changing the wire format for older clients. */
const PREFIX = "gzip:";
export const MAX_STORED_BYTES = 1_800_000;
export const MAX_UNCOMPRESSED_BYTES = 12_000_000;

export async function encodeSyncPayload(state: unknown): Promise<{ payload: string; bytes: number }> {
  const plain = JSON.stringify(state);
  const bytes = new TextEncoder().encode(plain);
  if (bytes.length <= MAX_STORED_BYTES) return { payload: plain, bytes: bytes.length };
  if (bytes.length > MAX_UNCOMPRESSED_BYTES) return { payload: "", bytes: bytes.length };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  let base64 = "";
  for (let i = 0; i < compressed.length; i += 8190) {
    base64 += btoa(String.fromCharCode(...compressed.subarray(i, i + 8190)));
  }
  return { payload: PREFIX + base64, bytes: PREFIX.length + base64.length };
}

export async function decodeSyncPayload(payload: string): Promise<unknown> {
  if (!payload.startsWith(PREFIX)) return JSON.parse(payload);
  const encoded = payload.slice(PREFIX.length);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < encoded.length; i += 10920) {
    chunks.push(Uint8Array.from(atob(encoded.slice(i, i + 10920)), (char) => char.charCodeAt(0)));
  }
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  const decompressed = new Blob([combined]).stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(decompressed).text();
  if (new TextEncoder().encode(text).length > MAX_UNCOMPRESSED_BYTES) throw new Error("Stored payload exceeds the safe limit");
  return JSON.parse(text);
}
