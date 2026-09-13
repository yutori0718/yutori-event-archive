import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

const EVENTS_COLLECTION = "events";

export async function listEvents() {
  const snapshot = await getDocs(collection(db, EVENTS_COLLECTION));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function getEvent(id) {
  const snap = await getDoc(doc(db, EVENTS_COLLECTION, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveEvent(id, data) {
  await setDoc(doc(db, EVENTS_COLLECTION, id), data);
}

export async function deleteEvent(id) {
  await deleteDoc(doc(db, EVENTS_COLLECTION, id));
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
