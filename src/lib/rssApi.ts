import { XMLParser } from 'fast-xml-parser';
import { Article, Category } from '../types';
import { detectCategory } from './categoryDetect';

interface RssFeed {
  name: string;
  shortName: string;   // shown as badge on cards
  url: string;
  categories: Category[];  // which Pulse categories this feed counts for
}

const RSS_FEEDS: RssFeed[] = [
  {
    name: 'TechCrunch',
    shortName: 'TC',
    url: 'https://techcrunch.com/feed/',
    categories: ['All', 'AI', 'Startups'],
  },
  {
    name: 'The Verge',
    shortName: 'VERGE',
    url: 'https://www.theverge.com/rss/index.xml',
    categories: ['All', 'AI', 'Science'],
  },
  {
    name: 'Wired',
    shortName: 'WIRED',
    url: 'https://www.wired.com/feed/rss',
    categories: ['All', 'AI', 'Security', 'Science'],
  },
  {
    name: 'Ars Technica',
    shortName: 'ARS',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    categories: ['All', 'Dev', 'Security', 'Science'],
  },
  {
    name: 'MIT Tech Review',
    shortName: 'MIT',
    url: 'https://www.technologyreview.com/feed/',
    categories: ['All', 'AI', 'Science'],
  },
  {
    name: 'Product Hunt',
    shortName: 'PH',
    url: 'https://www.producthunt.com/feed',
    categories: ['All', 'Startups', 'Dev'],
  },
  {
    name: 'VentureBeat',
    shortName: 'VB',
    url: 'https://venturebeat.com/feed/',
    categories: ['All', 'AI', 'Startups'],
  },
  {
    name: 'The Register',
    shortName: 'REG',
    url: 'https://www.theregister.com/headlines.atom',
    categories: ['All', 'Dev', 'Security'],
  },
  {
    name: 'ZDNet',
    shortName: 'ZDN',
    url: 'https://www.zdnet.com/news/rss.xml',
    categories: ['All', 'Dev', 'Security'],
  },
  {
    name: 'InfoQ',
    shortName: 'IQ',
    url: 'https://feed.infoq.com/',
    categories: ['All', 'Dev', 'AI'],
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item' || name === 'entry',
});

function parseDate(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  try {
    return new Date(raw).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function extractImageFromContent(content: string): string | undefined {
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1];
}

async function fetchFeed(feed: RssFeed, category: Category): Promise<Article[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'FiniteSocial/1.0 (mobile news reader)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = parser.parse(xml);

    // Handle both RSS 2.0 (channel.item) and Atom (feed.entry)
    const channel = parsed?.rss?.channel ?? parsed?.feed;
    if (!channel) return [];

    const items: any[] = channel.item ?? channel.entry ?? [];

    return items
      .slice(0, 15)
      .map((item: any, i: number): Article | null => {
        const title = stripHtml(
          typeof item.title === 'object' ? item.title['#text'] ?? '' : item.title ?? ''
        );
        if (!title) return null;

        const url =
          item.link?.['@_href'] ??
          (typeof item.link === 'string' ? item.link : item.link?.['#text']) ??
          item.id ??
          '';
        if (!url || !url.startsWith('http')) return null;

        const rawDesc =
          item['content:encoded'] ??
          item.description ??
          item.summary ??
          item.content?.['#text'] ??
          '';
        const summary = stripHtml(rawDesc).slice(0, 220).trim() || title;

        const pubDate = parseDate(
          item.pubDate ?? item.published ?? item.updated ?? item['dc:date']
        );

        // Extract image from media or content
        const imageUrl =
          item['media:content']?.['@_url'] ??
          item['media:thumbnail']?.['@_url'] ??
          item.enclosure?.['@_url'] ??
          extractImageFromContent(rawDesc) ??
          undefined;

        const author =
          item['dc:creator'] ??
          item.author?.name ??
          (typeof item.author === 'string' ? item.author : undefined) ??
          feed.name;

        const tags: string[] = [];
        if (item.category) {
          const cats = Array.isArray(item.category) ? item.category : [item.category];
          cats.forEach((c: any) => {
            const t = typeof c === 'string' ? c : c['#text'] ?? '';
            if (t) tags.push(t.toLowerCase());
          });
        }

        const detectedCat = category === 'All' ? detectCategory(title, tags) : category;

        return {
          id: `rss-${feed.shortName}-${i}-${pubDate}`,
          source: 'rss',
          rssSource: feed.name,
          title,
          summary,
          url,
          author,
          tags: tags.slice(0, 5),
          category: detectedCat,
          publishedAt: pubDate,
          imageUrl,
        };
      })
      .filter((a): a is Article => a !== null);
  } catch {
    return [];
  }
}

export async function fetchSingleSourceArticles(sourceName: string): Promise<Article[]> {
  const feed = RSS_FEEDS.find((f) => f.name === sourceName);
  if (!feed) return [];
  return fetchFeed(feed, 'All');
}

export async function fetchRssArticles(category: Category): Promise<Article[]> {
  const relevantFeeds = RSS_FEEDS.filter(
    (f) => f.categories.includes(category) || category === 'All'
  );

  const results = await Promise.allSettled(
    relevantFeeds.map((f) => fetchFeed(f, category))
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => (r as PromiseFulfilledResult<Article[]>).value);
}
