/* ============================================================
   storage.js — Only used for PIN session (sessionStorage).
   All app data now lives in Firestore.
   ============================================================ */
export const Storage = {
  isAdmin() {
    return !!sessionStorage.getItem('_sa');
  },
  setAdmin() {
    sessionStorage.setItem('_sa', '1');
  },
  clearAdmin() {
    sessionStorage.removeItem('_sa');
  }
};
