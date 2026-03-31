/* ============================================================
   storage.js — localStorage helpers
   All keys are prefixed with "sf_" to avoid collisions.
   ============================================================ */

const Storage = {
  get(key) {
    try {
      const raw = localStorage.getItem('sf_' + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem('sf_' + key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set failed:', e);
    }
  },

  remove(key) {
    localStorage.removeItem('sf_' + key);
  },

  clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sf_'));
    keys.forEach(k => localStorage.removeItem(k));
  }
};
