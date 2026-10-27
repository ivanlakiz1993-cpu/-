import { getNews, photoUrl, formatNewsDate, responsivePhotoSrcset } from './news-source.js?v=20261027-news-text-2';

const article = document.querySelector('[data-news-article]');
const status = document.querySelector('[data-news-status]');
const content = document.querySelector('[data-news-content]');
const heading = document.querySelector('[data-news-title]');
const crumb = document.querySelector('[data-news-crumb]');
const date = document.querySelector('[data-news-date]');
const photo = document.querySelector('[data-news-photo]');
const text = document.querySelector('[data-news-text]');

try {
  const item = await getNews(new URLSearchParams(location.search).get('slug'));
  if (!item) {
    heading.textContent = 'Новость не найдена';
    crumb.textContent = 'Новость не найдена';
    status.textContent = 'Эта новость недоступна. Вернитесь к списку новостей.';
    document.title = 'Новость не найдена — СпецЭлектроника';
  } else {
    heading.textContent = crumb.textContent = item.title;
    document.title = `${item.title} — СпецЭлектроника`;
    document.querySelector('meta[name="description"]').content = item.text.replace(/\s+/g, ' ').slice(0, 180) || item.title;
    date.dateTime = item.date;
    date.textContent = formatNewsDate(item.date);
    photo.alt = item.title;
    photo.loading = 'eager';
    photo.decoding = 'async';
    photo.fetchPriority = 'high';
    const srcset = responsivePhotoSrcset(item.photo);
    if (srcset) {
      photo.sizes = '(max-width: 56.25rem) 100vw, 50vw';
      photo.srcset = srcset;
    }
    photo.src = photoUrl(item.photo);
    const contentBlocks = item.text.replace(/\r\n?/g, '\n').split(/\n\s*\n/).filter(part => part.trim());
    text.replaceChildren(...contentBlocks.map(part => {
      const lines = part.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length && lines.every(line => line.startsWith('- '))) {
        const list = document.createElement('ul');
        for (const line of lines) {
          const item = document.createElement('li');
          item.textContent = line.slice(2).trim();
          list.append(item);
        }
        return list;
      }
      const p = document.createElement('p');
      p.textContent = part;
      return p;
    }));
    status.hidden = true;
    date.hidden = false;
    content.hidden = false;
  }
} catch (error) {
  console.error('News could not be loaded', error);
  heading.textContent = 'Не удалось загрузить новость';
  crumb.textContent = 'Новость';
  status.textContent = 'Попробуйте обновить страницу или вернитесь к списку новостей.';
} finally {
  article.setAttribute('aria-busy', 'false');
  window.siteTextReveal?.scan(article);
}
