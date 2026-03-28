window.FoodCatalog = (() => {

  const SEARCH_LIMIT = 30;
  let lastRemoteQuery = '';
  let lastRemoteResults = [];
  const FR_BRAND_HINTS = [
    'carrefour', 'auchan', 'u', 'super u', 'hyper u', 'marche u', 'monoprix', 'casino',
    'leclerc', 'marque repere', 'intermarche', 'paquito', 'pouce', 'lidl', 'aldi',
    'bjorg', 'danone', 'andros', 'heinz', 'amora', 'fleury michon', 'herta',
    'president', 'yoplait', 'candia', 'lactel', 'nestle dessert', 'lu', 'bonne maman'
  ];
  const FR_NAME_HINTS = [
    'poulet', 'boeuf', 'steak', 'jambon', 'riz', 'pates', 'yaourt', 'fromage', 'emmental',
    'camembert', 'mimolette', 'compote', 'biscotte', 'mayonnaise', 'moutarde', 'ketchup',
    'pain', 'baguette', 'frais', 'nature', 'francais', 'francaise'
  ];

  function normalize(value) {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function mapFood(row) {
    return {
      name: row.name,
      kcal: Number(row.kcal || 0),
      protein: Number(row.protein || 0),
      carbs: Number(row.carbs || 0),
      fat: Number(row.fat || 0),
      fibres: row.fibres == null ? null : Number(row.fibres),
      sodium: row.sodium == null ? null : Number(row.sodium),
      brand: row.brand || '',
      barcode: row.barcode || '',
      source: row.source || 'catalog',
      soldInFrance: !!row.sold_in_fr,
      popularity: Number(row.popularity || 0),
    };
  }

  function dedupe(foods) {
    const seen = new Set();
    return foods.filter(food => {
      const key = `${normalize(food.name)}|${normalize(food.brand || '')}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function tokenize(value) {
    return normalize(value).split(/\s+/).filter(Boolean);
  }

  function hasHint(value, hints) {
    return hints.some(hint => value.includes(hint));
  }

  function scoreFood(query, food, context = {}) {
    const normalizedQuery = normalize(query);
    const queryTokens = tokenize(query);
    const name = normalize(food.name);
    const brand = normalize(food.brand || '');
    const haystack = `${name} ${brand}`.trim();
    if (!normalizedQuery || !haystack) return 0;

    let score = 0;

    if (name === normalizedQuery) score += 900;
    if (haystack === normalizedQuery) score += 700;
    if (name.startsWith(normalizedQuery)) score += 420;
    if (haystack.startsWith(normalizedQuery)) score += 280;
    if (name.includes(normalizedQuery)) score += 180;
    if (brand.startsWith(normalizedQuery)) score += 90;

    let matchedTokens = 0;
    queryTokens.forEach(token => {
      if (name.startsWith(token)) score += 85;
      else if (name.includes(token)) score += 55;
      else if (brand.includes(token)) score += 18;
      if (haystack.includes(token)) matchedTokens += 1;
    });

    score += matchedTokens * 45;
    if (matchedTokens === queryTokens.length) score += 140;

    if (context.favoriteNames?.has(name)) score += 240;
    if (context.recentNames?.has(name)) score += 170;
    if (hasHint(brand, FR_BRAND_HINTS)) score += 170;
    if (hasHint(name, FR_NAME_HINTS)) score += 70;
    if (food.soldInFrance) score += 220;
    else if (food.source !== 'catalog') score -= 90;

    if (food.source === 'catalog') score += 90;
    if (food.source === 'off') score -= 60;

    if (food.popularity) score += Math.min(120, Math.log10(Number(food.popularity) + 1) * 28);

    return score;
  }

  function annotateFoods(foods, query, context) {
    return foods.map(food => ({
      ...food,
      _normName: normalize(food.name),
      _score: scoreFood(query, food, context),
    }));
  }

  function buildSections(query, foods, context = {}) {
    const sorted = annotateFoods(dedupe(foods), query, context)
      .filter(food => food._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, SEARCH_LIMIT);

    const favoriteMatches = sorted.filter(food => context.favoriteNames?.has(food._normName)).slice(0, 4);
    const recentMatches = sorted.filter(food => context.recentNames?.has(food._normName) && !favoriteMatches.includes(food)).slice(0, 4);
    const topMatches = sorted.filter(food => !favoriteMatches.includes(food) && !recentMatches.includes(food) && food.source !== 'off').slice(0, 8);
    const catalogMatches = sorted.filter(food => !favoriteMatches.includes(food) && !recentMatches.includes(food) && !topMatches.includes(food) && food.source !== 'off').slice(0, 10);
    const offMatches = sorted.filter(food => !favoriteMatches.includes(food) && !recentMatches.includes(food) && !topMatches.includes(food) && !catalogMatches.includes(food) && food.source === 'off').slice(0, 8);

    return [
      favoriteMatches.length ? { key: 'favorites', title: 'Favoris', items: favoriteMatches } : null,
      recentMatches.length ? { key: 'recents', title: 'Recents', items: recentMatches } : null,
      topMatches.length ? { key: 'top', title: 'Meilleures correspondances', items: topMatches } : null,
      catalogMatches.length ? { key: 'catalog', title: 'Catalogue', items: catalogMatches } : null,
      offMatches.length ? { key: 'off', title: 'Open Food Facts', items: offMatches } : null,
    ].filter(Boolean);
  }

  async function searchSupabase(query) {
    if (!window.DB || !query.trim()) return [];
    const normalized = normalize(query);
    if (lastRemoteQuery === normalized) return lastRemoteResults;

    try {
      const { data, error } = await DB.from('food_catalog')
        .select('name, brand, barcode, kcal, protein, carbs, fat, fibres, sodium, source, sold_in_fr, popularity')
        .ilike('name_normalized', `%${normalized}%`)
        .order('sold_in_fr', { ascending: false })
        .order('popularity', { ascending: false })
        .limit(SEARCH_LIMIT * 2);
      if (error) throw error;
      lastRemoteQuery = normalized;
      lastRemoteResults = (data || []).map(mapFood);
      return lastRemoteResults;
    } catch (err) {
      console.error('[FoodCatalog] searchSupabase:', err);
      lastRemoteQuery = normalized;
      lastRemoteResults = [];
      return [];
    }
  }

  async function searchOFF(query) {
    if (!query.trim()) return [];
    try {
      const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=18&fields=code,product_name,product_name_fr,brands,countries,countries_tags,nutriments`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return dedupe((json.products || []).map(product => {
        const n = product.nutriments || {};
        const kcal = n['energy-kcal_100g'] ?? Math.round((n['energy_100g'] ?? 0) / 4.184);
        const name = (product.product_name_fr || product.product_name || '').trim();
        if (!name) return null;
        const tags = (product.countries_tags || []).map(tag => normalize(tag));
        const countries = normalize(product.countries || '');
        return {
          name,
          brand: (product.brands || '').split(',')[0]?.trim() || '',
          barcode: product.code || '',
          kcal: Math.round(kcal || 0),
          protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
          carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
          fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
          fibres: n.fiber_100g == null ? null : Math.round(n.fiber_100g * 10) / 10,
          sodium: n.sodium_100g == null ? null : Math.round(n.sodium_100g * 1000),
          source: 'off',
          soldInFrance: tags.includes('en:france') || tags.includes('fr:france') || countries.includes('france'),
        };
      }).filter(Boolean)).sort((a, b) => {
        if (a.soldInFrance !== b.soldInFrance) return a.soldInFrance ? -1 : 1;
        return 0;
      });
    } catch (err) {
      console.error('[FoodCatalog] searchOFF:', err);
      return [];
    }
  }

  async function cacheFoods(foods) {
    if (!window.DB || !foods?.length) return;
    try {
      const rows = foods.map(food => ({
        name: food.name,
        name_normalized: normalize(food.name),
        brand: food.brand || null,
        barcode: food.barcode || '',
        kcal: food.kcal || 0,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        fibres: food.fibres,
        sodium: food.sodium,
        source: food.source || 'off',
        sold_in_fr: food.soldInFrance ?? false,
        popularity: 1,
      }));
      const { error } = await DB.from('food_catalog').upsert(rows, { onConflict: 'name_normalized,barcode' });
      if (error) throw error;
    } catch (err) {
      console.error('[FoodCatalog] cacheFoods:', err);
    }
  }

  async function search(query) {
    return searchDetailed(query).then(result => result.items);
  }

  async function searchDetailed(query, options = {}) {
    const trimmed = query.trim();
    const favoriteNames = new Set((options.favoriteFoods || []).map(food => normalize(food.name)));
    const recentNames = new Set((options.recentFoods || []).map(food => normalize(food.name)));
    const context = { favoriteNames, recentNames };
    if (!trimmed) {
      const items = FoodDB.search('').slice(0, 40);
      return { items, sections: [], total: items.length };
    }

    const [remoteFoods] = await Promise.all([searchSupabase(trimmed)]);
    const localFoods = FoodDB.search(trimmed);
    let merged = dedupe([...remoteFoods, ...localFoods]).slice(0, SEARCH_LIMIT * 2);

    if (merged.length < 8 && trimmed.length >= 2) {
      const offFoods = await searchOFF(trimmed);
      merged = dedupe([...merged, ...offFoods]).slice(0, SEARCH_LIMIT * 2);
      const newFoods = offFoods.filter(food => !remoteFoods.some(existing => normalize(existing.name) === normalize(food.name)));
      if (newFoods.length) cacheFoods(newFoods.slice(0, 10));
    }

    const sections = buildSections(trimmed, merged, context);
    const items = sections.flatMap(section => section.items).slice(0, SEARCH_LIMIT);
    return { items, sections, total: items.length };
  }

  return { search, searchDetailed, searchSupabase, searchOFF, cacheFoods, normalize };

})();
