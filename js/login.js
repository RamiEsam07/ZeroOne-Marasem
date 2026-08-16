/**
 * ZEROONE MARASEM — Login Controller
 * External module intentionally kept outside login.html so the CSP does not
 * block the submit handler.
 */
import { loginAdmin } from "./auth.js";

const form = document.getElementById("login-form");
const emailInput = document.getElementById("login-email");
const passwordInput = document.getElementById("login-password");
const button = document.getElementById("login-btn");
const errorEl = document.getElementById("login-error");

function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
}

function clearError() {
    errorEl.textContent = "";
    errorEl.classList.add("hidden");
}

function setLoading(loading) {
    button.disabled = loading;
    button.textContent = loading ? "جاري الدخول..." : "تسجيل الدخول";
    emailInput.disabled = loading;
    passwordInput.disabled = loading;
}

function friendlyAuthError(err) {
    if (err?.message === "NOT_AUTHORIZED") {
        return "تم تسجيل الدخول، لكن هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم.";
    }

    switch (err?.code) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        case "auth/too-many-requests":
            return "تمت محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
        case "auth/network-request-failed":
            return "تعذر الاتصال بخدمة Firebase. تحقق من الإنترنت وحاول مرة أخرى.";
        case "auth/invalid-email":
            return "أدخل بريدًا إلكترونيًا صحيحًا.";
        default:
            console.error("MARASEM login error:", err);
            return err?.message || "تعذر تسجيل الدخول الآن. حاول مرة أخرى.";
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError("أدخل البريد الإلكتروني وكلمة المرور.");
        return;
    }

    setLoading(true);

    try {
        await loginAdmin(email, password);
        window.location.replace("./index.html");
    } catch (err) {
        showError(friendlyAuthError(err));
        setLoading(false);
        passwordInput.focus();
        passwordInput.select();
    }
});
