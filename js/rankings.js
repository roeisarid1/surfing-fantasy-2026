/* ============================================================
   rankings.js — Rankings data provider.

   Priority:
     1. Firestore override (set via Admin page, shared with everyone)
     2. Local JSON files (data/current-rankings-*.json)

   Firestore collection: "overrides", documents: "men" / "women"
   ============================================================ */
import { db, doc, getDoc, setDoc, deleteDoc } from './firebase.js';

export const Rankings = {

  async get(gender) {
    // 1. Firestore override
    try {
      const snap = await getDoc(doc(db, 'overrides', gender));
      if (snap.exists() && snap.data().data?.length > 0) {
        return { data: snap.data().data, source: 'override' };
      }
    } catch (e) {
      console.warn('[Rankings] Firestore override read failed:', e.message);
    }

    // 2. Local JSON
    try {
      const res = await fetch('data/current-rankings-' + gender + '.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return { data, source: 'local' };
    } catch (e) {
      console.warn('[Rankings] JSON load failed:', e.message);
    }

    return { data: [], source: 'empty' };
  },

  async getBoth() {
    const [men, women] = await Promise.all([this.get('men'), this.get('women')]);
    return { men, women };
  },

  async setOverride(gender, data) {
    await setDoc(doc(db, 'overrides', gender), {
      updatedAt: new Date().toISOString(),
      data
    });
  },

  async clearOverride(gender) {
    await deleteDoc(doc(db, 'overrides', gender));
  },

  async getOverride(gender) {
    const snap = await getDoc(doc(db, 'overrides', gender));
    return snap.exists() ? snap.data() : null;
  }
};
