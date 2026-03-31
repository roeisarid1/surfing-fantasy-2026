/* ============================================================
   rankings.js — Data provider for WSL rankings.

   Priority chain (highest → lowest):
     1. Manual override (set via Admin page, stored in localStorage)
     2. Live fetch via allorigins.win CORS proxy → parse WSL HTML
     3. Local JSON fallback (data/current-rankings-*.json)

   Returns: { data: RankingEntry[], source: 'override'|'live'|'local'|'empty' }
   RankingEntry: { rank, name, country, points }
   ============================================================ */

const Rankings = {

  CACHE_TTL: 30 * 60 * 1000, // 30 minutes
  PROXY: 'https://api.allorigins.win/get?url=',
  WSL: {
    men:   'https://www.worldsurfleague.com/athletes/tour/mct?year=2026',
    women: 'https://www.worldsurfleague.com/athletes/tour/wct?year=2026'
  },

  /* ---- Main entry point ---- */
  async get(gender) {
    // 1. Manual override wins always
    const override = Storage.get('rankings_override_' + gender);
    if (override && override.data && override.data.length > 0) {
      return { data: override.data, source: 'override' };
    }

    // 2. Fresh cache → return immediately without re-fetching
    const cached = Storage.get('rankings_' + gender);
    if (cached && cached.data && cached.data.length > 0) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      if (age < this.CACHE_TTL) {
        return { data: cached.data, source: 'live' };
      }
    }

    // 3. Attempt live fetch
    try {
      const data = await this._fetchLive(gender);
      if (data && data.length > 0) {
        Storage.set('rankings_' + gender, {
          fetchedAt: new Date().toISOString(),
          data
        });
        return { data, source: 'live' };
      }
    } catch (e) {
      console.warn('[Rankings] Live fetch failed, falling back to JSON.', e.message);
    }

    // 4. Local JSON fallback
    try {
      const res = await fetch('data/current-rankings-' + gender + '.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return { data, source: 'local' };
    } catch (e) {
      console.warn('[Rankings] JSON fallback failed.', e.message);
    }

    return { data: [], source: 'empty' };
  },

  /* ---- Fetch both genders in parallel ---- */
  async getBoth() {
    const [men, women] = await Promise.all([
      this.get('men'),
      this.get('women')
    ]);
    return { men, women };
  },

  /* ---- Live fetch via CORS proxy ---- */
  async _fetchLive(gender) {
    const url = this.WSL[gender];
    const proxyUrl = this.PROXY + encodeURIComponent(url);
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('Proxy response ' + res.status);
    const json = await res.json();
    if (!json.contents) throw new Error('No contents in proxy response');
    return this._parseHTML(json.contents);
  },

  /* ---- Parse WSL HTML → RankingEntry[] ---- */
  _parseHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const athletes = [];

    // Strategy 1: Next.js __NEXT_DATA__ embedded JSON
    const nextDataEl = doc.getElementById('__NEXT_DATA__');
    if (nextDataEl) {
      try {
        const nextData = JSON.parse(nextDataEl.textContent);
        const props = nextData?.props?.pageProps;
        // Try common Next.js data shapes WSL has used
        const list =
          props?.athletes ||
          props?.rankings ||
          props?.tourAthletes ||
          props?.data?.athletes ||
          props?.data?.rankings ||
          [];
        if (list.length > 0) {
          return list.map((a, i) => ({
            rank: a.rank || a.rankNo || i + 1,
            name: (a.name || a.fullName || a.athleteName || '').trim(),
            country: (a.nationality || a.country || a.flagCode || '').trim().toUpperCase(),
            points: parseInt(a.points || a.totalPoints || a.rankingPoints || 0)
          })).filter(a => a.name.length > 0);
        }
      } catch (e) {
        // fall through to DOM parsing
      }
    }

    // Strategy 2: DOM selectors (WSL uses various class patterns)
    const selectors = [
      '.athlete-listing__item',
      '[class*="AthleteListing"]',
      '[class*="athlete-item"]',
      '[class*="ranking-item"]',
      'tr[class*="athlete"]'
    ];

    for (const sel of selectors) {
      const items = doc.querySelectorAll(sel);
      if (items.length === 0) continue;

      items.forEach((el, i) => {
        const nameEl =
          el.querySelector('[class*="name"],[class*="Name"]') ||
          el.querySelector('h3,h4,.title');
        const pointsEl =
          el.querySelector('[class*="point"],[class*="Point"],[class*="score"]');
        const countryEl =
          el.querySelector('[class*="country"],[class*="Country"],[class*="flag"],[class*="nation"]');

        const name = nameEl?.textContent?.trim();
        const points = parseInt((pointsEl?.textContent || '0').replace(/[^0-9]/g, '') || '0');
        const country = (countryEl?.textContent || '').trim().toUpperCase().slice(0, 3);

        if (name && name.length > 2) {
          athletes.push({ rank: i + 1, name, country, points });
        }
      });

      if (athletes.length > 0) return athletes;
    }

    return athletes; // may be empty → caller falls back to JSON
  },

  /* ---- Admin: set/clear override ---- */
  setOverride(gender, data) {
    Storage.set('rankings_override_' + gender, {
      updatedAt: new Date().toISOString(),
      data
    });
  },

  clearOverride(gender) {
    Storage.remove('rankings_override_' + gender);
  },

  clearCache(gender) {
    Storage.remove('rankings_' + gender);
  },

  getOverride(gender) {
    return Storage.get('rankings_override_' + gender);
  },

  getCache(gender) {
    return Storage.get('rankings_' + gender);
  }
};
