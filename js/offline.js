window.Offline = (() => {
  const IDB = 'elev-offline', STORE = 'queue';
  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(IDB, 1);
      req.onupgradeneeded = e => {
        if (!e.target.result.objectStoreNames.contains(STORE))
          e.target.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror   = () => rej(req.error);
    });
  }

  async function enqueue(table, payload) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ table, payload, ts: Date.now() });
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }

  async function getAll() {
    const db = await openDB();
    return new Promise(res => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror   = () => res([]);
    });
  }

  async function remove(id) {
    const db = await openDB();
    return new Promise(res => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res; tx.onerror = res;
    });
  }

  async function updateBanner() {
    const items  = await getAll();
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    const offline = !navigator.onLine;
    banner.classList.toggle('visible', offline || items.length > 0);
    const label = banner.querySelector('.offline-label');
    if (label) {
      label.textContent = offline
        ? `Hors-ligne${items.length ? ` · ${items.length} en attente` : ''}`
        : `${items.length} donnée(s) en attente de synchronisation`;
    }
  }

  async function sync() {
    if (!navigator.onLine || !window.DB) return;
    const items = await getAll();
    if (!items.length) { await updateBanner(); return; }
    let ok = 0;
    for (const item of items) {
      try {
        const { error } = await DB.from(item.table).insert(item.payload);
        if (!error) { await remove(item.id); ok++; }
      } catch(_) {}
    }
    if (ok) {
      showToast(`${ok} donnée(s) synchronisée(s) ✓`, 'success');
      document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab: AppState?.currentTab || 'home' } }));
    }
    await updateBanner();
  }

  async function tryInsert(table, payload) {
    if (navigator.onLine) {
      const { error } = await DB.from(table).insert(payload);
      if (error) throw error;
      return;
    }
    await enqueue(table, payload);
    showToast('Sauvegardé hors-ligne ☁', 'info');
    await updateBanner();
  }

  async function init() {
    await openDB();
    await updateBanner();
    if (navigator.onLine) await sync();
  }

  window.addEventListener('online',  () => sync());
  window.addEventListener('offline', () => updateBanner());

  return { init, tryInsert, sync, isOnline: () => navigator.onLine };
})();
