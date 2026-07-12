export function sanitizeFilename(value: string): string {
  const safe = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return safe || 'export';
}

export function downloadJson(filename: string, value: unknown): void {
  downloadText(filename, JSON.stringify(value, null, 2), 'application/json;charset=utf-8');
}

export function downloadText(filename: string, contents: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeFilename(filename);
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readTextFile(file: File, maximumBytes = 5_000_000): Promise<string> {
  if (file.size > maximumBytes) throw new Error(`File exceeds the ${Math.round(maximumBytes / 1_000_000)} MB safety limit.`);
  return file.text();
}
