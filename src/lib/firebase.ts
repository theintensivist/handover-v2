/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBfV8hnaOnsfN_e0SOEwVy__8KONZE2IWw",
  authDomain: "beaming-tracer-g224x.firebaseapp.com",
  projectId: "beaming-tracer-g224x",
  storageBucket: "beaming-tracer-g224x.firebasestorage.app",
  messagingSenderId: "74878201259",
  appId: "1:74878201259:web:402ee707cf058862c636ee"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with the user's specific database ID
const db = getFirestore(app, "ai-studio-icuhandoversyste-4dfb5d47-6360-439b-a514-f9d09fa9efe8");

export { db };
