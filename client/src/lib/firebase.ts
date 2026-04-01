import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
}

export async function firebaseSaveUser({ firstName, lastName, email, mobile, password }: UserData) {
  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const displayName = `${firstName} ${lastName}`.trim();
    await updateProfile(userCred.user, { displayName });

    // Store detailed user info in Firestore under "users" collection
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
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    return userCred.user;
  } catch (err: any) {
    console.error("[Firebase] login error:", err.message);
    return null;
  }
}
