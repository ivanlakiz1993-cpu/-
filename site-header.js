(() => {
  class SiteHeader extends HTMLElement {
    constructor() {
      super();
      this.handleKeydown = (event) => {
        const button = this.querySelector('.menu-toggle');
        if (event.key !== 'Escape' || button?.getAttribute('aria-expanded') !== 'true') return;
        this.setMenuOpen(false);
        button.focus();
      };
      this.handlePointerdown = (event) => {
        const button = this.querySelector('.menu-toggle');
        const drawer = this.querySelector('.menu-drawer');
        if (button?.getAttribute('aria-expanded') === 'true' && !this.contains(event.target)) {
          this.setMenuOpen(false);
        }
        if (button?.getAttribute('aria-expanded') === 'true' && event.target === drawer) {
          this.setMenuOpen(false);
        }
      };
    }

    connectedCallback() {
      if (this.dataset.ready === 'true') {
        document.addEventListener('keydown', this.handleKeydown);
        document.addEventListener('pointerdown', this.handlePointerdown);
        return;
      }
      this.dataset.ready = 'true';
      const currentPage = this.getAttribute('page') || '';
      const aboutCurrent = currentPage === 'about' ? ' aria-current="page"' : '';

      this.innerHTML = `
        <header class="topbar">
          <a class="brand" href="index.html#top" aria-label="СпецЭлектроника — главная">
            <img class="brand-mark" src="assets/footer-logo.svg" width="53" height="65" alt="">
            <span>СПЕЦ<br>ЭЛЕКТРОНИКА</span>
          </a>
        </header>
        <div class="menu-drawer">
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Открыть меню">
            <span>МЕНЮ</span>
            <span class="menu-icon" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
          <nav id="site-nav" class="nav" aria-label="Основная навигация">
            <div class="menu-nav-links">
              <a href="index.html#work">Производство</a>
              <a href="index.html#work">Разработка</a>
              <a href="testing.html">Испытания</a>
              <a href="about.html"${aboutCurrent}>О нас</a>
              <a href="news.html">Новости</a>
              <a href="index.html#contact">Контакты</a>
            </div>
            <div class="menu-social" role="group" aria-label="Мы в социальных сетях">
              <a class="menu-social__link menu-social__link--vk" href="index.html#contact" aria-label="ВКонтакте"><img src="assets/social/vk.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--rutube" href="index.html#contact" aria-label="Rutube"><img src="assets/social/rutube.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--dzen" href="index.html#contact" aria-label="Дзен"><img src="assets/social/dzen.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--max" href="index.html#contact" aria-label="MAX"><img src="assets/social/max.svg" alt=""></a>
              <a class="menu-social__link menu-social__link--telegram" href="index.html#contact" aria-label="Telegram"><img src="assets/social/telegram.svg" alt=""></a>
            </div>
          </nav>
        </div>`;

      const button = this.querySelector('.menu-toggle');
      const navigation = this.querySelector('#site-nav');
      const drawer = this.querySelector('.menu-drawer');

      navigation.querySelectorAll('.menu-nav-links a').forEach((link, rowIndex) => {
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

      button.addEventListener('click', () => {
        this.setMenuOpen(button.getAttribute('aria-expanded') !== 'true');
      });
      navigation.addEventListener('click', (event) => {
        if (event.target.closest('a')) this.setMenuOpen(false);
      });
      drawer.addEventListener('click', (event) => {
        if (event.target === drawer) this.setMenuOpen(false);
      });
      document.addEventListener('keydown', this.handleKeydown);
      document.addEventListener('pointerdown', this.handlePointerdown);
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.handleKeydown);
      document.removeEventListener('pointerdown', this.handlePointerdown);
    }

    setMenuOpen(open) {
      const button = this.querySelector('.menu-toggle');
      const drawer = this.querySelector('.menu-drawer');
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      drawer.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('menu-open', open);
      document.body.classList.toggle('menu-open', open);
    }
  }

  if (!customElements.get('site-header')) customElements.define('site-header', SiteHeader);
})();
