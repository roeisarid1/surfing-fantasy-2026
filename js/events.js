/* ============================================================
   events.js — Firestore CRUD for competition events.

   Collection: "events"
   Document fields:
     name:      string
     date:      string (ISO date, e.g. "2026-04-15")
     type:      "competition" | "season"
     order:     number (sort order)
     completed: boolean
     men:       Array<{rank, name, country}>
     women:     Array<{rank, name, country}>
   ============================================================ */
import { db, collection, getDocs, doc, setDoc, deleteDoc } from './firebase.js';

export const Events = {

  async getAll() {
    // 1. Load local JSON as base (season skeleton)
    let base = [];
    try {
      const res = await fetch('data/season-2026.json?v=' + Date.now());
      if (res.ok) base = await res.json();
    } catch(e) { console.warn('[Events] JSON load failed:', e.message); }

    // 2. Load Firestore overrides (admin-saved results)
    const fsMap = {};
    try {
      const snap = await getDocs(collection(db, 'events'));
      snap.docs.forEach(d => { fsMap[d.id] = { id: d.id, ...d.data() }; });
    } catch(e) { console.warn('[Events] Firestore read failed:', e.message); }

    // 3. Merge: Firestore overrides base by id; Firestore-only events appended
    const baseIds = new Set(base.map(e => e.id));
    const merged  = base.map(ev => fsMap[ev.id] ? fsMap[ev.id] : ev);
    Object.values(fsMap).forEach(ev => { if (!baseIds.has(ev.id)) merged.push(ev); });

    merged.sort((a, b) => (a.order || 0) - (b.order || 0));
    return merged;
  },

  async save(id, data) {
    await setDoc(doc(db, 'events', id), data);
  },

  async remove(id) {
    await deleteDoc(doc(db, 'events', id));
  }
};
