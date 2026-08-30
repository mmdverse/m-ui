/**
 * Best-effort server location lookup from the host (ip-api.com, free, no key).
 * Never blocks or fails the caller: returns null on any error and the caller
 * falls back to a manual label.
 */
export async function detectLocation(
  host: string
): Promise<{ location: string; source: 'auto' } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(host)}?fields=status,country,regionName,city`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'success') return null;
    const parts = [data.city, data.regionName, data.country].filter(Boolean);
    if (!parts.length) return null;
    return { location: [...new Set(parts)].join('، '), source: 'auto' };
  } catch {
    return null;
  }
}
