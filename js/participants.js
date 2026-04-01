/* ============================================================
   participants.js — Firestore CRUD for participants & predictions
   Collections: "participants", "predictions"
   ============================================================ */
import { db, collection, doc, getDoc, getDocs, setDoc, deleteDoc } from './firebase.js';

export const Participants = {

  LOCK_MS: 60 * 60 * 1000,

  /* ---- Participants ---- */

  async getAll() {
    const snap = await getDocs(collection(db, 'participants'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  async getById(id) {
    const snap = await getDoc(doc(db, 'participants', id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async add(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = Date.now().toString();
    const p = { id, name: trimmed, createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'participants', id), p);
    return p;
  },

  async update(id, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await setDoc(doc(db, 'participants', id), { name: trimmed }, { merge: true });
  },

  async delete(id) {
    await deleteDoc(doc(db, 'participants', id));
    await deleteDoc(doc(db, 'predictions', id));
  },

  /* ---- Predictions ---- */

  async getPredictions(id) {
    const snap = await getDoc(doc(db, 'predictions', id));
    return snap.exists() ? snap.data() : null;
  },

  // First save sets submittedAt; subsequent saves within lock window preserve it
  async savePredictions(id, men, women) {
    const existing = await this.getPredictions(id);
    const submittedAt = existing ? existing.submittedAt : new Date().toISOString();
    await setDoc(doc(db, 'predictions', id), { submittedAt, men, women });
    return { submittedAt, men, women };
  },

  isLocked(submittedAt) {
    if (!submittedAt) return false;
    return Date.now() - new Date(submittedAt).getTime() >= this.LOCK_MS;
  },

  msUntilLock(submittedAt) {
    if (!submittedAt) return 0;
    const elapsed = Date.now() - new Date(submittedAt).getTime();
    return Math.max(0, this.LOCK_MS - elapsed);
  }
};
