/**
 * ZEROONE MARASEM
 * Login Controller
 */

import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const message = document.getElementById("message");


function showMessage(text, type = "error") {

    message.textContent = text;

    message.className = `message ${type}`;
}


function setLoading(loading) {

    loginButton.disabled = loading;

    loginButton.textContent = loading
        ? "جارٍ تسجيل الدخول..."
        : "تسجيل الدخول";
}


function getFirebaseErrorMessage(error) {

    switch (error?.code) {

        case "auth/invalid-credential":
            return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";

        case "auth/invalid-email":
            return "صيغة البريد الإلكتروني غير صحيحة.";

        case "auth/user-not-found":
            return "هذا الحساب غير موجود في Firebase Authentication.";

        case "auth/wrong-password":
            return "كلمة المرور غير صحيحة.";

        case "auth/too-many-requests":
            return "تمت محاولات كثيرة. حاول مرة أخرى لاحقًا.";

        case "auth/network-request-failed":
            return "تعذر الاتصال بـ Firebase. تأكد من الإنترنت.";

        default:
            return error?.message || "حدث خطأ غير معروف.";
    }
}


form.addEventListener("submit", async (event) => {

    // أهم سطر في حل المشكلة الحالية
    event.preventDefault();

    event.stopPropagation();

    showMessage("", "error");
    message.style.display = "none";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {

        showMessage("أدخل البريد الإلكتروني وكلمة المرور.");

        return;
    }

    setLoading(true);

    try {

        console.log("MARASEM LOGIN: starting...");

        // 1 — Firebase Authentication
        const credential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = credential.user;

        console.log("MARASEM LOGIN: authenticated", user.uid);


        // 2 — قراءة صلاحية المستخدم
        const adminRef =
            doc(db, "admins", user.uid);

        const adminSnap =
            await getDoc(adminRef);


        if (!adminSnap.exists()) {

            console.error(
                "MARASEM LOGIN: admin document not found"
            );

            await signOut(auth);

            showMessage(
                "تم تسجيل الدخول، لكن هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم."
            );

            setLoading(false);

            return;
        }


        const adminData = adminSnap.data();

        const role =
            String(adminData.role || "")
                .trim()
                .toLowerCase();


        console.log(
            "MARASEM LOGIN: role =",
            role
        );


        if (!role) {

            await signOut(auth);

            showMessage(
                "حساب الإدارة موجود، لكن لم يتم تحديد صلاحية role."
            );

            setLoading(false);

            return;
        }


        if (role !== "admin" &&
            role !== "manager" &&
            role !== "staff" &&
            role !== "viewer") {

            await signOut(auth);

            showMessage(
                "صلاحية الحساب غير معروفة: " + role
            );

            setLoading(false);

            return;
        }


        // 3 — نجاح
        showMessage(
            "تم تسجيل الدخول بنجاح. جارٍ فتح لوحة التحكم...",
            "success"
        );

        setLoading(true);


        // 4 — فتح لوحة التحكم
        setTimeout(() => {

            window.location.replace("./index.html");

        }, 500);


    } catch (error) {

        console.error(
            "MARASEM LOGIN ERROR:",
            error
        );

        showMessage(
            getFirebaseErrorMessage(error)
        );

        setLoading(false);
    }

}); 
