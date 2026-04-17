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
    const snap = await getDocs(collection(db, 'events'));
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    events.sort((a, b) => (a.order || 0) - (b.order || 0));
    return events;
  },

  async save(id, data) {
    await setDoc(doc(db, 'events', id), data);
  },

  async remove(id) {
    await deleteDoc(doc(db, 'events', id));
  }
};
