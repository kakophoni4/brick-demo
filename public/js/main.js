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
})();
