(() => {
  class SiteHeader extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready === 'true') return;
      this.dataset.ready = 'true';

      const page = this.getAttribute('page') || '';
      const isHome = page === 'home';
      const currentPage = page === 'news-article' ? 'news' : page;
      const homeAnchor = (section) => `${isHome ? '' : 'index.html'}#${section}`;
      const current = (route) => currentPage === route ? ' aria-current="page"' : '';
      const contactsHref = currentPage === 'contacts' ? '#top' : 'contacts.html';

      this.innerHTML = `
        <header class="topbar">
          <a class="brand" href="${homeAnchor('top')}" aria-label="СпецЭлектроника — главная">
            <img class="brand-mark" src="assets/footer-logo.svg" width="53" height="65" fetchpriority="high" alt="">
            <span>СПЕЦ<br>ЭЛЕКТРОНИКА</span>
          </a>
        </header>
        <div class="menu-drawer">
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Открыть меню">
            <span>МЕНЮ</span>
            <span class="menu-icon" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
          <nav id="site-nav" class="nav" aria-label="Основная навигация" aria-hidden="true">
            <div class="menu-nav-links">
              <a href="${homeAnchor('work')}">Производство</a>
              <a href="${homeAnchor('work')}">Разработка</a>
              <a href="testing.html"${current('testing')}>Испытания</a>
              <a href="about.html"${current('about')}>О нас</a>
              <a href="news.html"${current('news')}>Новости</a>
              <a href="${contactsHref}"${current('contacts')}>Контакты</a>
            </div>
            <div class="menu-social" role="group" aria-label="Мы в социальных сетях">
              <a class="menu-social__link menu-social__link--vk" href="${homeAnchor('contact')}" aria-label="ВКонтакте"><img src="assets/social/vk.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--rutube" href="${homeAnchor('contact')}" aria-label="Rutube"><img src="assets/social/rutube.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--dzen" href="${homeAnchor('contact')}" aria-label="Дзен"><img src="assets/social/dzen.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--max" href="${homeAnchor('contact')}" aria-label="MAX"><img src="assets/social/max.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--telegram" href="${homeAnchor('contact')}" aria-label="Telegram"><img src="assets/social/telegram.svg" alt=""></a>
            </div>
          </nav>
        </div>`;

      this.button = this.querySelector('.menu-toggle');
      this.navigation = this.querySelector('#site-nav');
      this.drawer = this.querySelector('.menu-drawer');
      this.navigation.querySelectorAll('.menu-nav-links a').forEach((link, rowIndex) => {
        const label = link.textContent.trim();
        link.setAttribute('aria-label', label);
        link.replaceChildren(...Array.from(label, (character, letterIndex) => {
          const letter = document.createElement('span');
          letter.className = 'menu-letter';
          letter.setAttribute('aria-hidden', 'true');
          letter.textContent = character;
          letter.style.setProperty('--letter-delay', `${70 + rowIndex * 35 + letterIndex * 12}ms`);
          return letter;
        }));
      });

      this.handleClick = () => this.setMenuOpen(this.button.getAttribute('aria-expanded') !== 'true');
      this.handleNavigationClick = (event) => {
        if (event.target.closest('a')) this.setMenuOpen(false);
      };
      this.handleDrawerClick = (event) => {
        if (event.target === this.drawer) this.setMenuOpen(false);
      };
      this.handleKeydown = (event) => {
        if (event.key !== 'Escape' || this.button.getAttribute('aria-expanded') !== 'true') return;
        this.setMenuOpen(false);
        this.button.focus();
      };
      this.handlePointerdown = (event) => {
        if (this.button.getAttribute('aria-expanded') === 'true' && !this.drawer.contains(event.target)) {
          this.setMenuOpen(false);
        }
      };

      this.button.addEventListener('click', this.handleClick);
      this.navigation.addEventListener('click', this.handleNavigationClick);
      this.drawer.addEventListener('click', this.handleDrawerClick);
      document.addEventListener('keydown', this.handleKeydown);
      document.addEventListener('pointerdown', this.handlePointerdown);
    }

    disconnectedCallback() {
      this.button?.removeEventListener('click', this.handleClick);
      this.navigation?.removeEventListener('click', this.handleNavigationClick);
      this.drawer?.removeEventListener('click', this.handleDrawerClick);
      document.removeEventListener('keydown', this.handleKeydown);
      document.removeEventListener('pointerdown', this.handlePointerdown);
    }

    setMenuOpen(open) {
      this.button.setAttribute('aria-expanded', String(open));
      this.button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      this.drawer.classList.toggle('is-open', open);
      this.navigation.setAttribute('aria-hidden', String(!open));
      document.documentElement.classList.toggle('menu-open', open);
      document.body.classList.toggle('menu-open', open);
    }
  }

  if (!customElements.get('site-header')) customElements.define('site-header', SiteHeader);
})();
