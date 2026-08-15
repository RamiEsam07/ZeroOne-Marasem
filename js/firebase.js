/**
 * ZEROONE MARASEM — Firebase Initialization (single source of truth)
 * Every other module imports app/db/auth from here instead of calling
 * initializeApp() again.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// NOTE: this is the Firebase *Web Config* — it identifies the project, it is
// not a secret (that's normal and safe for a client-side app). What must
// never be public is a Service Account key / Admin SDK credential, and this
// project has none in the frontend.
const firebaseConfig = {
    apiKey: "AIzaSyDpxg5wlffI99e-RkVQr5KSJvxgcTRi-qk",
    authDomain: "zeroone-marasem.firebaseapp.com",
    databaseURL: "https://zeroone-marasem-default-rtdb.firebaseio.com",
    projectId: "zeroone-marasem",
    storageBucket: "zeroone-marasem.firebasestorage.app",
    messagingSenderId: "877024473882",
    appId: "1:877024473882:web:5787cf853b42f51b5672a3",
    measurementId: "G-KQ971Y16XH"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
