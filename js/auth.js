/**
 * ZEROONE MARASEM — Authentication & Role Resolution
 * Production authentication layer.
 *
 * Flow:
 * Firebase Authentication
 *        ↓
 * /admins/{uid}
 *        ↓
 * role
 *        ↓
 * Admin Dashboard
 */

import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;
let currentRole = null;
let currentAdminName = null;


/* =========================================================
   ROLES
   ========================================================= */

const ROLE_LABELS = {
    admin: "مدير النظام",
    manager: "مدير المناسبة",
    staff: "فريق الاستقبال",
    viewer: "مشاهدة فقط"
};


/* =========================================================
   PERMISSIONS
   ========================================================= */

const PERMISSIONS = {
    admin: {
        manageGuests: true,
        delivery: true,
        checkin: true,
        analytics: true,
        deleteGuest: true,
        manageRoles: true
    },

    manager: {
        manageGuests: true,
        delivery: true,
        checkin: true,
        analytics: true,
        deleteGuest: false,
        manageRoles: false
    },

    staff: {
        manageGuests: false,
        delivery: false,
        checkin: true,
        analytics: false,
        deleteGuest: false,
        manageRoles: false
    },

    viewer: {
        manageGuests: false,
        delivery: false,
        checkin: false,
        analytics: true,
        deleteGuest: false,
        manageRoles: false
    }
};


/* =========================================================
   PERMISSION HELPERS
   ========================================================= */

export function can(permission) {
    if (!currentRole) {
        return false;
    }

    return !!(
        PERMISSIONS[currentRole] &&
        PERMISSIONS[currentRole][permission]
    );
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


/* =========================================================
   ADMIN ROLE RESOLUTION
   ========================================================= */

/**
 * Reads:
 *
 * /admins/{authenticated-user-uid}
 *
 * This function intentionally throws the real error instead
 * of converting every failure into "NOT_AUTHORIZED".
 */
async function resolveRole(user) {

    if (!user || !user.uid) {
        throw new Error("AUTH_USER_MISSING");
    }

    try {

        console.log(
            "[MARASEM AUTH] Authenticated UID:",
            user.uid
        );

        const adminRef = doc(
            db,
            "admins",
            user.uid
        );

        console.log(
            "[MARASEM AUTH] Reading Firestore document:",
            adminRef.path
        );

        const snap = await getDoc(adminRef);

        console.log(
            "[MARASEM AUTH] Admin document exists:",
            snap.exists()
        );


        /* -----------------------------------------------------
           Document does not exist
           ----------------------------------------------------- */

        if (!snap.exists()) {

            currentRole = null;
            currentAdminName = null;

            const error = new Error(
                `ADMIN_DOCUMENT_NOT_FOUND: admins/${user.uid}`
            );

            error.code = "ADMIN_DOCUMENT_NOT_FOUND";

            console.error(
                "[MARASEM AUTH] Admin document was not found:",
                `admins/${user.uid}`
            );

            throw error;
        }


        /* -----------------------------------------------------
           Read admin data
           ----------------------------------------------------- */

        const data = snap.data();

        console.log(
            "[MARASEM AUTH] Admin document data:",
            {
                role: data.role,
                name: data.name,
                email: data.email
            }
        );


        /* -----------------------------------------------------
           Role validation
           ----------------------------------------------------- */

        if (!data.role) {

            currentRole = null;
            currentAdminName = null;

            const error = new Error(
                "ADMIN_ROLE_MISSING"
            );

            error.code = "ADMIN_ROLE_MISSING";

            throw error;
        }


        const normalizedRole =
            String(data.role)
                .trim()
                .toLowerCase();


        if (!PERMISSIONS[normalizedRole]) {

            currentRole = null;
            currentAdminName = null;

            const error = new Error(
                `INVALID_ADMIN_ROLE: ${data.role}`
            );

            error.code = "INVALID_ADMIN_ROLE";

            console.error(
                "[MARASEM AUTH] Invalid role:",
                data.role
            );

            throw error;
        }


        /* -----------------------------------------------------
           Success
           ----------------------------------------------------- */

        currentRole = normalizedRole;

        currentAdminName =
            data.name ||
            user.displayName ||
            user.email ||
            "Admin";


        console.log(
            "[MARASEM AUTH] Authorization successful:",
            {
                uid: user.uid,
                role: currentRole,
                name: currentAdminName
            }
        );

        return true;

    } catch (err) {

        console.error(
            "[MARASEM AUTH] ROLE RESOLUTION ERROR:",
            err
        );

        currentRole = null;
        currentAdminName = null;

        throw err;
    }
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

export async function loginAdmin(email, password) {

    try {

        console.log(
            "[MARASEM AUTH] Starting login..."
        );

        const cred =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        console.log(
            "[MARASEM AUTH] Firebase login successful:",
            cred.user.uid
        );


        await resolveRole(cred.user);


        console.log(
            "[MARASEM AUTH] Admin authorization successful."
        );


        return cred.user;

    } catch (err) {

        console.error(
            "[MARASEM AUTH] LOGIN ERROR:",
            err
        );


        /*
         * If Firebase login succeeded but authorization failed,
         * immediately sign out so an unauthorized session isn't
         * left active.
         */

        try {
            if (auth.currentUser) {
                await signOut(auth);
            }
        } catch (signOutError) {

            console.error(
                "[MARASEM AUTH] Sign-out after failed login failed:",
                signOutError
            );
        }


        /*
         * Preserve the actual error.
         * login.js can now display the real diagnostic state.
         */

        throw err;
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

export async function logoutAdmin() {

    currentRole = null;
    currentAdminName = null;
    currentUser = null;

    await signOut(auth);
}


/* =========================================================
   PAGE GUARD
   ========================================================= */

export function guardAdminPage(
    onReady,
    onDenied
) {

    onAuthStateChanged(
        auth,
        async (user) => {

            /* ---------------------------------------------
               No authenticated user
               --------------------------------------------- */

            if (!user) {

                currentUser = null;
                currentRole = null;
                currentAdminName = null;

                window.location.href = "login.html";

                return;
            }


            currentUser = user;


            /* ---------------------------------------------
               Resolve admin role
               --------------------------------------------- */

            try {

                await resolveRole(user);

            } catch (err) {

                console.error(
                    "[MARASEM AUTH] Page authorization failed:",
                    err
                );


                if (typeof onDenied === "function") {

                    onDenied(err);

                } else {

                    document.body.innerHTML = `
                        <div style="
                            min-height:100vh;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            padding:24px;
                            background:#211C17;
                            color:#F7F3EA;
                            font-family:Arial,sans-serif;
                            text-align
