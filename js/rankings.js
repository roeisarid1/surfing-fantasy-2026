/* ============================================================
   rankings.js — Data provider for WSL rankings.

   Priority chain (highest → lowest):
     1. Manual override (set via Admin page, stored in localStorage)
     2. Local JSON files (data/current-rankings-*.json)

   Returns: { data: RankingEntry[], source: 'override'|'local'|'empty' }
   RankingEntry: { rank, name, country, points }
   ============================================================ */

const Rankings = {

  /* ---- Main entry point ---- */
  async get(gender) {
    // 1. Manual override wins always
    const override = Storage.get('rankings_override_' + gender);
    if (override && override.data && override.data.length > 0) {
      return { data: override.data, source: 'override' };
    }

    // 2. Local JSON
    try {
      const res = await fetch('data/current-rankings-' + gender + '.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return { data, source: 'local' };
    } catch (e) {
      console.warn('[Rankings] JSON load failed.', e.message);
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

  getOverride(gender) {
    return Storage.get('rankings_override_' + gender);
  }
};
