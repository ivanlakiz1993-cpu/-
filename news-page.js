(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#site-nav');
  const menuDrawer = document.querySelector('.menu-drawer');
  if (menuButton && navigation && menuDrawer) {
    const setMenuOpen = open => {
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.setAttribute('aria-label', open ? '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e' : '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e');
      navigation.classList.toggle('open', open);
      menuDrawer.classList.toggle('is-open', open);
      navigation.setAttribute('aria-hidden', String(!open));
      document.documentElement.classList.toggle('menu-open', open);
    };
    menuButton.addEventListener('click', () => setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true'));
    navigation.addEventListener('click', event => {
      if (event.target.closest('a')) setMenuOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') setMenuOpen(false);
    });
    document.addEventListener('click', event => {
      if (menuButton.getAttribute('aria-expanded') === 'true' && !menuDrawer.contains(event.target)) setMenuOpen(false);
    });
  }

  const filter = document.querySelector('#news-filter');
  const grid = document.querySelector('#news-stories');
  if (!filter || !grid) return;
  const filterWrap = filter.closest('.news-page__filter-wrap');
  const filterLabel = filterWrap?.querySelector('label');
  const cards = [...grid.querySelectorAll('.news-page__card')];
  const trigger = document.createElement('button');
  const currentLabel = document.createElement('span');
  const optionsList = document.createElement('div');
  let isOpen = false;
  let activeIndex = -1;

  filter.classList.add('news-page__filter--native');
  filter.tabIndex = -1;
  filter.setAttribute('aria-hidden', 'true');
  trigger.type = 'button';
  trigger.className = 'news-page__filter news-page__filter-trigger';
  trigger.id = 'news-filter-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'news-filter-options');
  currentLabel.id = 'news-filter-current';
  if (filterLabel) {
    filterLabel.id = 'news-filter-label';
    trigger.setAttribute('aria-labelledby', `${filterLabel.id} ${currentLabel.id}`);
  } else {
    trigger.setAttribute('aria-labelledby', currentLabel.id);
  }
  trigger.append(currentLabel);

  optionsList.className = 'news-page__filter-options';
  optionsList.id = 'news-filter-options';
  optionsList.setAttribute('role', 'listbox');
  optionsList.hidden = true;
  filter.after(trigger, optionsList);

  const getAvailableOptions = () => [...filter.options].filter(option => option.value !== filter.value);
  const setActiveOption = index => {
    const options = [...optionsList.querySelectorAll('.news-page__filter-option')];
    activeIndex = !options.length || index < 0 ? -1 : index % options.length;
    options.forEach((option, optionIndex) => {
      option.classList.toggle('is-hovered', optionIndex === activeIndex);
    });
    if (activeIndex < 0) trigger.removeAttribute('aria-activedescendant');
    else trigger.setAttribute('aria-activedescendant', options[activeIndex].id);
  };
  const renderOptions = () => {
    optionsList.replaceChildren();
    getAvailableOptions().forEach((option, index) => {
      const item = document.createElement('div');
      item.className = 'news-page__filter-option';
      item.id = `news-filter-option-${index}`;
      item.dataset.value = option.value;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      item.textContent = option.textContent.trim();
      item.addEventListener('pointerenter', () => setActiveOption(index));
      item.addEventListener('click', () => {
        filter.value = option.value;
        setOpen(false);
        filter.dispatchEvent(new Event('change', { bubbles: true }));
        trigger.focus();
      });
      optionsList.append(item);
    });
    setActiveOption(-1);
  };
  const setOpen = open => {
    isOpen = open;
    filterWrap.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
    optionsList.hidden = !open;
    if (open) renderOptions();
    else setActiveOption(-1);
  };
  const update = () => {
    currentLabel.textContent = filter.options[filter.selectedIndex]?.textContent.trim() || '';
    let visible = 0;
    cards.forEach(card => {
      const show = filter.value === 'all' || card.dataset.category === filter.value;
      card.hidden = !show;
      visible += Number(show);
    });
    grid.classList.toggle('is-empty', visible === 0);
    if (isOpen) renderOptions();
  };

  trigger.addEventListener('click', () => setOpen(!isOpen));
  trigger.addEventListener('keydown', event => {
    const options = getAvailableOptions();
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab' && isOpen) {
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) setOpen(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveOption(activeIndex < 0 ? (direction > 0 ? 0 : options.length - 1) : (activeIndex + direction + options.length) % options.length);
    } else if ((event.key === 'Enter' || event.key === ' ') && isOpen && activeIndex >= 0) {
      event.preventDefault();
      const activeOption = getAvailableOptions()[activeIndex];
      if (activeOption) {
        filter.value = activeOption.value;
        setOpen(false);
        filter.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
      event.preventDefault();
      setOpen(true);
    }
  });
  optionsList.addEventListener('pointerleave', () => setActiveOption(-1));
  document.addEventListener('click', event => {
    if (isOpen && !filterWrap.contains(event.target)) setOpen(false);
  });
  filter.addEventListener('change', update);
  update();
})();
