import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAv0eldz5uFg8BfR2haVSm3hRLASL3hiCM",
  authDomain: "atomquest-portal.firebaseapp.com",
  projectId: "atomquest-portal",
  storageBucket: "atomquest-portal.firebasestorage.app",
  messagingSenderId: "722320918782",
  appId: "1:722320918782:web:96dd2687b40908b9317daf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary app used EXCLUSIVELY for Admin account creation without signing out the Admin session
export const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
