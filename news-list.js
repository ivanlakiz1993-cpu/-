import { listNews, newsUrl, photoUrl, formatNewsDate } from './news-source.js?v=20261024-news-template-1';

const grid = document.querySelector('#news-stories');
const legacyCategories = { 'victory-day': 'holidays', laboratory: 'laboratory', forum: 'forum', 'womens-day': 'holidays' };
const legacyStyles = { 'victory-day': 'victory', laboratory: 'laboratory', forum: 'forum', 'womens-day': 'womens-day' };

try {
  const items = await listNews();
  const cards = items.map(item => {
    const card = document.createElement('a');
    card.className = 'news-page__card';
    if (legacyStyles[item.slug]) card.classList.add(`news-page__card--${legacyStyles[item.slug]}`);
    card.id = `story-${item.slug}`;
    card.href = newsUrl(item.slug);
    card.dataset.category = legacyCategories[item.slug] || 'events';
    const image = document.createElement('img');
    image.className = 'news-page__image';
    image.src = photoUrl(item.photo);
    image.alt = item.title;
    image.decoding = 'async';
    const copy = document.createElement('span');
    copy.className = 'news-page__copy';
    const title = document.createElement('span');
    title.className = 'news-page__headline';
    title.textContent = item.title;
    const date = document.createElement('time');
    date.className = 'news-page__date';
    date.dateTime = item.date;
    date.textContent = formatNewsDate(item.date);
    copy.append(title, date);
    card.append(image, copy);
    return card;
  });
  const empty = grid.querySelector('.news-page__empty');
  grid.replaceChildren(...cards, ...(empty ? [empty] : []));
  document.dispatchEvent(new Event('news:loaded'));
} catch (error) {
  // Retain the existing list if the collection is temporarily unavailable.
  console.error('News collection could not be loaded', error);
}
