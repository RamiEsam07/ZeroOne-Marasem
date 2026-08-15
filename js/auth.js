/**
 * ZEROONE MARASEM — Authentication & Role Resolution
 * Handles admin login/logout and resolves the signed-in user's role from
 * /admins/{uid}. UI-level hiding of buttons is a convenience only — the
 * real enforcement lives in firestore.rules.
 */
import { auth, db } from "./firebase.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser = null;
let currentRole = null;
let currentAdminName = null;

const ROLE_LABELS = {
    admin: 'مدير النظام',
    manager: 'مدير المناسبة',
    staff: 'فريق الاستقبال',
    viewer: 'مشاهدة فقط'
};

const PERMISSIONS = {
    admin:   { manageGuests: true,  delivery: true, checkin: true, analytics: true, deleteGuest: true, manageRoles: true },
    manager: { manageGuests: true,  delivery: true, checkin: true, analytics: true, deleteGuest: false, manageRoles: false },
    staff:   { manageGuests: false, delivery: false, checkin: true, analytics: false, deleteGuest: false, manageRoles: false },
    viewer:  { manageGuests: false, delivery: false, checkin: false, analytics: true, deleteGuest: false, manageRoles: false }
};

export function can(permission) {
    if (!currentRole) return false;
    return !!(PERMISSIONS[currentRole] && PERMISSIONS[currentRole][permission]);
}

export function getCurrentRole() {
    return currentRole;
}

export function getCurrentAdminName() {
    return currentAdminName;
}

export function getRoleLabel(role) {
    return ROLE_LABELS[role] || role;
}

// Resolves once per session; called from onAuthStateChanged.
async function resolveRole(user) {
    try {
        const snap = await getDoc(doc(db, "admins", user.uid));
        if (snap.exists()) {
            currentRole = snap.data().role || null;
            currentAdminName = snap.data().name || user.email;
            return true;
        }
        currentRole = null;
        currentAdminName = null;
        return false;
    } catch (err) {
        console.error("Error resolving admin role:", err);
        currentRole = null;
        return false;
    }
}

export async function loginAdmin(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const isAuthorized = await resolveRole(cred.user);
    if (!isAuthorized) {
        await signOut(auth);
        throw new Error("NOT_AUTHORIZED");
    }
    return cred.user;
}

export async function logoutAdmin() {
    currentRole = null;
    currentAdminName = null;
    currentUser = null;
    await signOut(auth);
}

/**
 * Guards a page: redirects to login.html if not signed in, or shows an
 * access-denied state if signed in but not present in /admins.
 * Calls onReady(user, role) once resolved and authorized.
 */
export function guardAdminPage(onReady, onDenied) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        currentUser = user;
        const authorized = await resolveRole(user);
        if (!authorized) {
            if (typeof onDenied === 'function') {
                onDenied();
            } else {
                document.body.innerHTML = `
                    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">
                        <div style="text-align:center;">
                            <h1>Access Denied</h1>
                            <p>هذا الحساب غير مصرح له بالدخول إلى لوحة التحكم.</p>
                        </div>
                    </div>`;
            }
            return;
        }
        if (typeof onReady === 'function') onReady(currentUser, currentRole);
    });
}

window.MARASEM_AUTH = {
    loginAdmin,
    logoutAdmin,
    guardAdminPage,
    can,
    getCurrentRole,
    getCurrentAdminName,
    getRoleLabel
};
