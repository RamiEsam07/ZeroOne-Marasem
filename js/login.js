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


/* =========================================================
   CHECK LOGIN ELEMENTS
========================================================= */

if (!form || !emailInput || !passwordInput || !loginButton || !message) {

    console.error("ZEROONE MARASEM: Login elements missing.");

    if (message) {
        message.style.display = "block";
        message.textContent =
            "حدث خطأ في واجهة تسجيل الدخول. تأكد من IDs في login.html.";
        message.className = "message error";
    }

} else {


    /* =====================================================
       MESSAGE
    ===================================================== */

    function showMessage(text, type = "error") {

        message.style.display = "block";

        message.textContent = text;

        message.className = `message ${type}`;
    }


    /* =====================================================
       LOADING
    ===================================================== */

    function setLoading(loading) {

        loginButton.disabled = loading;

        loginButton.textContent = loading
            ? "جارٍ تسجيل الدخول..."
            : "تسجيل الدخول";
    }


    /* =====================================================
       FIREBASE ERROR TRANSLATION
    ===================================================== */

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
                return "تعذر الاتصال بـ Firebase. تحقق من الإنترنت.";

            case "auth/user-disabled":
                return "هذا الحساب معطل في Firebase.";

            default:
                return error?.message ||
                    "حدث خطأ غير معروف.";
        }
    }


    /* =====================================================
       LOGIN
    ===================================================== */

    form.addEventListener("submit", async (event) => {

        event.preventDefault();
        event.stopPropagation();

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        showMessage("", "error");
        message.style.display = "none";


        /* VALIDATION */

        if (!email) {

            showMessage("أدخل البريد الإلكتروني.");

            emailInput.focus();

            return;
        }


        if (!password) {

            showMessage("أدخل كلمة المرور.");

            passwordInput.focus();

            return;
        }


        setLoading(true);


        try {

            console.log("================================");
            console.log("ZEROONE MARASEM LOGIN");
            console.log("Starting authentication...");
            console.log("Email:", email);


            /* =================================================
               STEP 1
               FIREBASE AUTHENTICATION
            ================================================= */

            const credential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user = credential.user;

            console.log(
                "Authentication successful."
            );

            console.log(
                "Firebase UID:",
                user.uid
            );


            /* =================================================
               STEP 2
               GET ADMIN DOCUMENT
            ================================================= */

            const adminRef =
                doc(
                    db,
                    "admins",
                    user.uid
                );


            console.log(
                "Looking for Firestore document:"
            );

            console.log(
                "admins/" + user.uid
            );


            const adminSnap =
                await getDoc(adminRef);


            /* =================================================
               ADMIN DOCUMENT NOT FOUND
            ================================================= */

            if (!adminSnap.exists()) {

                console.error(
                    "ADMIN DOCUMENT NOT FOUND"
                );

                console.error(
                    "Expected path:",
                    "admins/" + user.uid
                );


                await signOut(auth);


                showMessage(
                    "تم التحقق من الحساب، لكن لم يتم العثور على صلاحية الإدارة لهذا الحساب."
                );


                setLoading(false);

                return;
            }


            /* =================================================
               STEP 3
               READ ROLE
            ================================================= */

            const adminData =
                adminSnap.data();


            const role =
                String(
                    adminData.role || ""
                )
                .trim()
                .toLowerCase();


            const adminName =
                adminData.name ||
                user.email;


            console.log(
                "Admin name:",
                adminName
            );

            console.log(
                "Role:",
                role
            );


            /* =================================================
               ROLE VALIDATION
            ================================================= */

            const allowedRoles = [
                "admin",
                "manager",
                "staff",
                "viewer"
            ];


            if (!allowedRoles.includes(role)) {

                console.error(
                    "Invalid role:",
                    role
                );


                await signOut(auth);


                showMessage(
                    "صلاحية الحساب غير صحيحة. يجب أن تكون admin أو manager أو staff أو viewer."
                );


                setLoading(false);

                return;
            }


            /* =================================================
               SUCCESS
            ================================================= */

            console.log(
                "LOGIN SUCCESS"
            );

            console.log(
                "Role:",
                role
            );


            showMessage(
                "تم تسجيل الدخول بنجاح ✓",
                "success"
            );


            /* =================================================
               REDIRECT
            ================================================= */

            setTimeout(() => {

                window.location.replace(
                    "./index.html"
                );

            }, 700);

        }


        catch (error) {

            console.error(
                "ZEROONE MARASEM LOGIN ERROR:",
                error
            );


            showMessage(
                getFirebaseErrorMessage(error)
            );


            setLoading(false);
        }

    });

} 
