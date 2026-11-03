/** Sanitize export filenames for PDF/DOCX/MD downloads. */
export function reportFileStem(title: string, at = new Date()): string {
  const safe = (title || "benchmate-report")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48) || "benchmate-report";
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
  return `benchmate-report-${stamp}-${safe}`;
}
