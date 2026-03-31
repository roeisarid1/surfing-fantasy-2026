/* ============================================================
   participants.js — Participant CRUD + prediction management
   ============================================================ */

const Participants = {

  LOCK_MS: 60 * 60 * 1000, // 1 hour in milliseconds

  /* ---- Participant CRUD ---- */

  getAll() {
    return Storage.get('participants') || [];
  },

  getById(id) {
    return this.getAll().find(p => p.id === id) || null;
  },

  add(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const list = this.getAll();
    const p = {
      id: Date.now().toString(),
      name: trimmed,
      createdAt: new Date().toISOString()
    };
    list.push(p);
    Storage.set('participants', list);
    return p;
  },

  update(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const list = this.getAll();
    const p = list.find(p => p.id === id);
    if (!p) return false;
    p.name = trimmed;
    Storage.set('participants', list);
    return true;
  },

  delete(id) {
    const list = this.getAll().filter(p => p.id !== id);
    Storage.set('participants', list);
    Storage.remove('predictions_' + id);
  },

  /* ---- Predictions ---- */

  getPredictions(id) {
    return Storage.get('predictions_' + id) || null;
  },

  // Save predictions. First save sets submittedAt; subsequent saves within
  // the lock window preserve the original submittedAt.
  savePredictions(id, men, women) {
    const existing = this.getPredictions(id);
    const submittedAt = existing ? existing.submittedAt : new Date().toISOString();
    const data = { submittedAt, men, women };
    Storage.set('predictions_' + id, data);
    return data;
  },

  isLocked(id) {
    const pred = this.getPredictions(id);
    if (!pred) return false;
    return Date.now() - new Date(pred.submittedAt).getTime() >= this.LOCK_MS;
  },

  // Milliseconds remaining before lock (0 if already locked or no predictions)
  msUntilLock(id) {
    const pred = this.getPredictions(id);
    if (!pred) return 0;
    const elapsed = Date.now() - new Date(pred.submittedAt).getTime();
    return Math.max(0, this.LOCK_MS - elapsed);
  },

  hasSubmitted(id) {
    return !!this.getPredictions(id);
  }
};
