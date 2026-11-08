(() => {
  const forms = document.querySelectorAll('form.production-consultation__form');

  forms.forEach((form) => {
    const submitButton = form.querySelector('.production-consultation__submit');
    const submitLabel = submitButton.querySelector('span');
    const feedback = form.querySelector('.production-consultation__feedback');
    let pending = false;
    let succeeded = false;

    form.addEventListener('input', () => {
      if (pending) return;
      succeeded = false;
      form.classList.remove('is-submitted');
      submitButton.disabled = false;
      feedback.textContent = '';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (pending || succeeded) return;

      if (window.location.protocol === 'file:') {
        feedback.textContent = 'Форма отправляется с опубликованного сайта по HTTPS. Откройте сайт по веб-адресу и попробуйте ещё раз.';
        return;
      }

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload._replyto = formData.get('email');
      const pageUrl = new URL(window.location.href);
      pageUrl.hash = '';
      payload._url = pageUrl.href;

      pending = true;
      form.setAttribute('aria-busy', 'true');
      submitButton.disabled = true;
      submitLabel.textContent = 'Отправляем…';
      feedback.textContent = '';

      const endpoint = new URL(form.action);
      endpoint.pathname = `/ajax${endpoint.pathname}`;

      try {
        const response = await fetch(endpoint.href, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        const accepted = result.success === true || result.success === 'true';
        if (!response.ok || !accepted) throw new Error('FormSubmit did not accept the request');

        succeeded = true;
        form.classList.add('is-submitted');
        feedback.textContent = 'Заявка отправлена. Если это первая отправка, подтвердите адрес в письме от FormSubmit.';
      } catch (error) {
        submitButton.disabled = false;
        feedback.textContent = 'Не удалось связаться с формой. Проверьте соединение и подтвердите адрес в FormSubmit, если ещё не сделали этого.';
      } finally {
        pending = false;
        form.removeAttribute('aria-busy');
        submitLabel.textContent = 'Отправить';
      }
    });
  });
})();
