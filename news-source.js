import { newsApiBase } from './news-cms-config.js?v=20261024-news-template-1';

let collectionRequest;
export function newsUrl(slug) {
  return `news-article.html?slug=${encodeURIComponent(slug)}`;
}

export function photoUrl(photo) {
  const url = new URL(photo, document.baseURI);
  if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('News photographs must use same-origin image URLs');
  }
  return url.href;
}

const responsiveNewsPhotos = new Map([
  ['news-forum.webp', 2528], ['news-victory.webp', 4096],
  ['news-womens-day.webp', 2730], ['news-laboratory.webp', 2730]
]);

export function responsivePhotoSrcset(photo) {
  const url = new URL(photoUrl(photo));
  const parts = url.pathname.split('/');
  const filename = decodeURIComponent(parts[parts.length - 1] || '');
  const originalWidth = responsiveNewsPhotos.get(filename);
  if (!originalWidth) return '';
  const stem = url.pathname.slice(0, -'.webp'.length);
  const variants = [640, 1280, 1920].map(width => `${url.origin}${stem}-${width}w.webp ${width}w`);
  variants.push(`${url.href} ${originalWidth}w`);
  return variants.join(', ');
}

function validateNews(item) {
  if (!item || typeof item.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)
    || typeof item.title !== 'string' || !item.title.trim()
    || typeof item.text !== 'string' || typeof item.photo !== 'string' || !item.photo
    || typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
    || Number.isNaN(Date.parse(`${item.date}T00:00:00Z`))
    || new Date(`${item.date}T00:00:00Z`).toISOString().slice(0, 10) !== item.date) {
    throw new Error('Invalid news record');
  }
  photoUrl(item.photo);
  return item;
}

async function requestJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`News request failed: ${response.status}`);
  return response.json();
}

export async function listNews() {
  if (!collectionRequest) collectionRequest = requestJson(newsApiBase || 'content/news.json').then(data => {
    if (!data || !Array.isArray(data.items)) throw new Error('Invalid news collection');
    return data.items.map(validateNews).sort((a, b) => b.date.localeCompare(a.date));
  });
  return collectionRequest;
}

export async function getNews(slug) {
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (newsApiBase) {
    const item = await requestJson(`${newsApiBase.replace(/\/$/, '')}/${encodeURIComponent(slug)}`);
    return item ? validateNews(item) : null;
  }
  return (await listNews()).find(item => item.slug === slug) || null;
}

export function formatNewsDate(date) {
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
