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
