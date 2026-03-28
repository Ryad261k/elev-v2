/* ── Confirm bottom sheet ──────────────────────── */
window.showConfirm = function(msg, onConfirm, {
  title = '', danger = true,
  confirmLabel = 'Confirmer', cancelLabel = 'Annuler', onCancel = null
} = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="confirm-sheet">
      <div class="confirm-handle"></div>
      ${title ? `<p class="confirm-title">${title}</p>` : ''}
      <p class="confirm-msg">${msg}</p>
      <div class="confirm-actions">
        <button class="btn btn-secondary btn-full confirm-ok"
          style="${danger ? 'color:var(--color-danger);border-color:var(--color-danger);' : ''}">${confirmLabel}</button>
        <button class="btn btn-ghost btn-full confirm-cancel">${cancelLabel}</button>
      </div>
    </div>`;

  function close(confirmed) {
    const sheet = overlay.querySelector('.confirm-sheet');
    sheet.style.animation = 'sheetSlideDown 200ms ease-in forwards';
    sheet.addEventListener('animationend', () => {
      overlay.remove();
      if (confirmed && onConfirm) onConfirm();
    }, { once: true });
  }

  overlay.querySelector('.confirm-ok').addEventListener('click', () => close(true));
  overlay.querySelector('.confirm-cancel').addEventListener('click', () => { close(false); if (onCancel) onCancel(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
  document.body.appendChild(overlay);
};

window.InputValidation = (() => {
  function apply(input, isValid) {
    if (!input) return;
    const icon = document.createElement('span');
    icon.className = 'iv-icon';
    input.insertAdjacentElement('afterend', icon);
    function check() {
      const v = input.value;
      if (!v) { icon.className = 'iv-icon'; icon.textContent = ''; return; }
      const ok = isValid(v);
      icon.className = `iv-icon ${ok ? 'iv-ok' : 'iv-err'}`;
      icon.textContent = ok ? '✓' : '✗';
    }
    input.addEventListener('input', check);
    input.addEventListener('blur',  check);
  }

  const is = {
    email:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    pw:       v => v.length >= 6,
    positive: v => parseFloat(v) > 0,
    weight:   v => parseFloat(v) >= 10 && parseFloat(v) <= 500,
  };

  return { apply, is };
})();
