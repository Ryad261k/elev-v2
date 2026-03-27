/* ============================================
   BARCODE.JS — Scan code-barre + Open Food Facts
   Élev v2
   ============================================ */

window.BarcodeScanner = (() => {

  let stream   = null;
  let rafId    = null;
  let detector = null;
  let onResult = null;
  let overlay  = null;
  let scanning = false;

  /* ── Open Food Facts ────────────────────── */
  async function fetchProduct(barcode) {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('Réseau indisponible');
    const json = await res.json();
    if (json.status !== 1 || !json.product) throw new Error('Produit introuvable dans la base Open Food Facts');
    const p = json.product;
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] ?? Math.round((n['energy_100g'] ?? 0) / 4.184);
    return {
      name:    (p.product_name_fr || p.product_name || '').trim() || `Produit ${barcode}`,
      kcal:    Math.round(kcal || 0),
      protein: Math.round((n.proteins_100g        ?? 0) * 10) / 10,
      carbs:   Math.round((n.carbohydrates_100g   ?? 0) * 10) / 10,
      fat:     Math.round((n.fat_100g             ?? 0) * 10) / 10,
    };
  }

  /* ── Overlay UI ─────────────────────────── */
  function buildOverlay() {
    const el = document.createElement('div');
    el.id = 'barcode-overlay';
    el.innerHTML = `
      <div class="barcode-box">
        <div class="barcode-header">
          <p class="barcode-title">Scanner un code-barre</p>
          <button class="btn btn-icon" id="barcode-close">✕</button>
        </div>
        <div class="barcode-viewport">
          <video id="barcode-video" autoplay playsinline muted></video>
          <div class="barcode-reticle"></div>
          <p id="barcode-status" class="barcode-status">Pointe la caméra vers le code-barre</p>
        </div>
        <div class="barcode-fallback">
          <p class="barcode-fallback-label">Ou entre le code manuellement :</p>
          <div class="flex gap-8">
            <input type="number" id="barcode-manual-inp" class="input"
                   placeholder="3017624010701" inputmode="numeric" style="flex:1;margin:0;">
            <button class="btn btn-secondary" id="barcode-manual-btn">OK</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('#barcode-close').addEventListener('click', close);
    el.querySelector('#barcode-manual-btn').addEventListener('click', () => {
      const code = el.querySelector('#barcode-manual-inp').value.trim();
      if (code) handleBarcode(code);
    });
    el.querySelector('#barcode-manual-inp').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const code = el.querySelector('#barcode-manual-inp').value.trim();
        if (code) handleBarcode(code);
      }
    });
    return el;
  }

  function setStatus(msg, isError = false) {
    const el = document.getElementById('barcode-status');
    if (el) {
      el.textContent = msg;
      el.style.color = isError ? '#e05c5c' : 'var(--cream)';
    }
  }

  /* ── Détection ──────────────────────────── */
  async function handleBarcode(code) {
    if (!scanning) return;
    scanning = false;
    stopDetectionLoop();
    setStatus('Recherche du produit…');
    try {
      const food = await fetchProduct(code);
      if (navigator.vibrate) navigator.vibrate(40);
      close();
      if (onResult) onResult(food);
    } catch (err) {
      setStatus(err.message || 'Produit introuvable', true);
      scanning = true;
      if (stream) startDetectionLoop();
    }
  }

  function stopDetectionLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  async function detectionFrame() {
    if (!scanning || !detector || !stream) return;
    const video = document.getElementById('barcode-video');
    if (video && video.readyState >= 2) {
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) { await handleBarcode(codes[0].rawValue); return; }
      } catch (_) {}
    }
    rafId = requestAnimationFrame(detectionFrame);
  }

  function startDetectionLoop() {
    stopDetectionLoop();
    rafId = requestAnimationFrame(detectionFrame);
  }

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const video = document.getElementById('barcode-video');
      if (video) { video.srcObject = stream; await video.play(); }
      if (detector) startDetectionLoop();
    } catch (_) {
      setStatus('Caméra inaccessible — entre le code manuellement', true);
    }
  }

  function stopCamera() {
    stopDetectionLoop();
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const video = document.getElementById('barcode-video');
    if (video) video.srcObject = null;
  }

  /* ── API publique ───────────────────────── */
  function scan(callback) {
    onResult = callback;
    scanning = true;
    overlay  = buildOverlay();
    requestAnimationFrame(() => overlay.classList.add('open'));

    if ('BarcodeDetector' in window) {
      try {
        detector = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });
      } catch (_) { detector = null; }
    }

    if (!detector) {
      setStatus('Scanner non disponible — entre le code manuellement');
    }
    startCamera();
  }

  function close() {
    scanning = false;
    stopCamera();
    overlay?.classList.remove('open');
    setTimeout(() => { overlay?.remove(); overlay = null; }, 250);
    detector = null;
    onResult = null;
  }

  return { scan, close };

})();
