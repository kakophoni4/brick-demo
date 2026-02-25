'use strict';

(function () {
  // Мобильное меню
  const toggle = document.querySelector('[data-nav-toggle]');
  const list = document.querySelector('[data-nav-list]');
  if (toggle && list) {
    toggle.addEventListener('click', () => {
      list.classList.toggle('is-open');
      toggle.classList.toggle('is-open');
    });
  }

  // Модалка
  const modal = document.querySelector('[data-modal]');
  const modalSource = modal ? modal.querySelector('[data-modal-source]') : null;

  function openModal(sourceText) {
    if (!modal) return;
    if (modalSource && sourceText) modalSource.value = sourceText;
    modal.hidden = false;
    document.body.classList.add('is-locked');
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('is-locked');
  }

  document.querySelectorAll('[data-open-lead]').forEach(btn => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-source') || 'Лид';
      openModal(src);
    });
  });

  document.querySelectorAll('[data-modal-close]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Формы (AJAX, чтобы красиво показать результат)
  async function submitLeadForm(form) {
    const result = form.querySelector('[data-form-result]');
    if (result) result.textContent = '';

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    // простая валидация
    if (!payload.name || !payload.phone) {
      if (result) result.textContent = 'Заполните имя и телефон.';
      return;
    }

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.ok) {
        if (result) result.textContent = data.message || 'Ошибка отправки.';
        return;
      }

      if (result) result.textContent = data.message || 'Готово.';
      form.reset();
    } catch (e) {
      if (result) result.textContent = 'Сеть/сервер недоступны. Проверьте консоль.';
    }
  }

  document.querySelectorAll('[data-lead-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitLeadForm(form);
    });
  });

  // Карусель фото в карточках каталога (свайп и кнопки)
  document.querySelectorAll('.product__media--carousel').forEach(carousel => {
    const imgs = carousel.querySelectorAll('.product__media-img');
    if (imgs.length <= 1) return;
    const card = carousel.closest('.product');
    const prevBtn = card.querySelector('[data-product-prev]');
    const nextBtn = card.querySelector('[data-product-next]');
    let idx = 0;
    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      imgs.forEach((el, k) => el.classList.toggle('is-active', k === idx));
    }
    if (prevBtn) prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      show(idx - 1);
    });
    if (nextBtn) nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      show(idx + 1);
    });
    let startX = 0;
    let moved = false;
    carousel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      moved = false;
    }, { passive: true });
    carousel.addEventListener('touchmove', (e) => {
      if (Math.abs(e.touches[0].clientX - startX) > 30) moved = true;
    }, { passive: true });
    carousel.addEventListener('touchend', (e) => {
      if (!moved) return;
      const endX = e.changedTouches[0].clientX;
      if (endX < startX - 30) show(idx + 1);
      else if (endX > startX + 30) show(idx - 1);
    });
  });
})();
