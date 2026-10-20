// Lazy Open Graph image fetcher with module-level cache.
// Fetches the article HTML and extracts og:image / twitter:image meta tags.
// Legal: these are public meta tags publishers expose specifically for link previews.

const cache = new Map<string, string | null>(); // null = fetched, no image found
const inFlight = new Map<string, Promise<string | null>>();

export async function fetchOgImage(articleUrl: string): Promise<string | null> {
  if (cache.has(articleUrl)) return cache.get(articleUrl) ?? null;
  if (inFlight.has(articleUrl)) return inFlight.get(articleUrl)!;

  const p = (async (): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(articleUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          Accept: 'text/html',
        },
      });
      clearTimeout(id);

      if (!res.ok) {
        cache.set(articleUrl, null);
        return null;
      }

      const html = await res.text();

      // Match both attribute orderings (property/content and content/property)
      let m =
        html.match(/<meta\s[^>]*property=["']og:image["'][^>]*content=["']([^"']{8,})["']/i) ??
        html.match(/<meta\s[^>]*content=["']([^"']{8,})["'][^>]*property=["']og:image["']/i) ??
        html.match(/<meta\s[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']{8,})["']/i) ??
        html.match(/<meta\s[^>]*content=["']([^"']{8,})["'][^>]*name=["']twitter:image(?::src)?["']/i);

      const img = m?.[1] ?? null;
      cache.set(articleUrl, img);
      return img;
    } catch {
      cache.set(articleUrl, null);
      return null;
    }
  })();

  inFlight.set(articleUrl, p);
  const result = await p;
  inFlight.delete(articleUrl);
  return result;
}
