import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, Auth } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp, Firestore } from "firebase/firestore";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

const isConfigured = apiKey && authDomain && projectId &&
  apiKey !== "undefined" && authDomain !== "undefined" && projectId !== "undefined";

if (isConfigured) {
  try {
    app = initializeApp({
      apiKey,
      authDomain,
      projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err: any) {
    console.warn("[Firebase] Initialization failed:", err.message);
    app = null;
    auth = null;
    db = null;
  }
}

export { auth, db };

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
}

export async function firebaseSaveUser({ firstName, lastName, email, mobile, password }: UserData) {
  if (!auth || !db) return null;
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const displayName = `${firstName} ${lastName}`.trim();
    await updateProfile(userCred.user, { displayName });

    await setDoc(doc(db, "users", userCred.user.uid), {
      firstName,
      lastName,
      email,
      mobile: mobile || "",
      createdAt: serverTimestamp(),
    });

    return userCred.user;
  } catch (err: any) {
    if (err.code === "auth/email-already-in-use") return null;
    console.error("[Firebase] saveUser error:", err.message);
    return null;
  }
}

export async function firebaseLoginUser(email: string, password: string) {
  if (!auth) return null;
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    return userCred.user;
  } catch (err: any) {
    console.error("[Firebase] login error:", err.message);
    return null;
  }
}
