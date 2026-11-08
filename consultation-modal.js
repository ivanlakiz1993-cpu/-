(() => {
  const triggers = document.querySelectorAll('[data-consultation-modal-trigger]');
  if (!triggers.length) return;

  const modal = document.createElement('dialog');
  modal.className = 'consultation-modal';
  modal.setAttribute('aria-label', 'Форма консультации');
  modal.innerHTML = `
    <button class="consultation-modal__close" type="button" aria-label="Закрыть форму"><img src="assets/consultation-modal-close.svg" alt=""></button>
    <p class="consultation-modal__description">Отправьте свой вопрос нам и получите индивидуальную консультацию специалиста</p>
    <form class="consultation-modal__form" action="https://formsubmit.co/gromf1493@mail.ru" method="POST" enctype="multipart/form-data">
      <input type="hidden" name="_subject" value="Заявка на консультацию — СпецЭлектроника">
      <input type="text" name="_honey" tabindex="-1" autocomplete="off" hidden>
      <div class="consultation-modal__fields">
        <input class="consultation-modal__field" name="name" type="text" placeholder="Как Вам обращаться" aria-label="Как Вам обращаться" autocomplete="name" required>
        <input class="consultation-modal__field" name="email" type="email" placeholder="Ваша почта" aria-label="Ваша почта" autocomplete="email" required>
        <input class="consultation-modal__field" name="phone" type="tel" placeholder="Ваш телефон" aria-label="Ваш телефон" autocomplete="tel">
        <textarea class="consultation-modal__field consultation-modal__field--message" name="message" placeholder="Комментарий или вопрос" aria-label="Комментарий или вопрос" required></textarea>
        <label class="consultation-modal__attachment">
          <span class="consultation-modal__attachment-label consultation-modal__filename">Прикрепить файл</span>
          <span class="consultation-modal__formats">.pdf, .docx, .png, .jpg, до 10 МБ<img src="assets/consultation-modal-paperclip.svg" alt=""></span>
          <input class="consultation-modal__file" type="file" name="attachment" accept=".pdf,.docx,.png,.jpg,.jpeg" aria-label="Прикрепить файл">
        </label>
      </div>
      <label class="consultation-modal__consent"><input type="checkbox" name="consent" value="yes" required><span>Я соглашаюсь с <a href="privacy-policy.html" target="_blank" rel="noopener">политикой конфиденциальности</a> и <a href="personal-data-processing.html" target="_blank" rel="noopener">обработкой персональных данных</a></span></label>
      <button class="consultation-modal__submit" type="submit">Отправить</button>
      <p class="consultation-modal__feedback" role="alert" aria-live="polite"></p>
    </form>`;
  document.body.append(modal);

  const file = modal.querySelector('.consultation-modal__file');
  const filename = modal.querySelector('.consultation-modal__filename');
  const feedback = modal.querySelector('.consultation-modal__feedback');
  let opener = null;
  let previousOverflow = '';

  triggers.forEach((trigger) => trigger.addEventListener('click', (event) => {
    event.preventDefault();
    opener = trigger;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.showModal();
    document.dispatchEvent(new Event('site:consultation-modal-open'));
    modal.querySelector('.consultation-modal__close').focus();
  }));
  modal.querySelector('.consultation-modal__close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', (event) => {
    const rect = modal.getBoundingClientRect();
    if (event.target === modal && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) modal.close();
  });
  modal.addEventListener('close', () => {
    document.dispatchEvent(new Event('site:consultation-modal-close'));
    document.body.style.overflow = previousOverflow;
    opener?.focus();
  });
  file.addEventListener('change', () => {
    filename.textContent = file.files[0]?.name || 'Прикрепить файл';
    feedback.textContent = file.files[0]?.size > 10 * 1024 * 1024 ? 'Размер файла не должен превышать 10 МБ.' : '';
  });
  modal.querySelector('form').addEventListener('submit', (event) => {
    if (file.files[0]?.size > 10 * 1024 * 1024) {
      event.preventDefault();
      feedback.textContent = 'Размер файла не должен превышать 10 МБ.';
      file.focus();
    }
  });
})();
