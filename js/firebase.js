/* ============================================================
   firebase.js — Firebase initialization & Firestore exports
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDr6zMHMmV6eCooEuUIeyfWNxCvemKAzzU",
  authDomain: "surfing-fantasy.firebaseapp.com",
  projectId: "surfing-fantasy",
  storageBucket: "surfing-fantasy.firebasestorage.app",
  messagingSenderId: "574406425157",
  appId: "1:574406425157:web:6ea9184f82d209740d412c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot };
