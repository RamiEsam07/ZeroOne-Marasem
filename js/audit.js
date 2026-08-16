/**
 * ZEROONE MARASEM — Audit Log
 * Immutable log of every admin-side mutation. Written to /auditLogs.
 */
import { db } from "./firebase.js";
import { auth } from "./firebase.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auditCollection = collection(db, "auditLogs");

/**
 * @param {string} action - one of: created, updated, deleted, deliveryPrepared, rsvpUpdated, checkedIn
 * @param {string} targetId - the guest token / id the action applies to
 * @param {object} meta - optional extra context (kept small, no sensitive data)
 */
export async function logAudit(action, targetId, meta = {}) {
    try {
        const user = auth.currentUser;
        await addDoc(auditCollection, {
            action,
            targetId: targetId || null,
            actorId: user ? user.uid : null,
            actorEmail: user ? user.email : null,
            meta,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        // Audit logging should never block the primary action.
        console.error("Audit log write failed:", err);
    }
}

window.MARASEM_AUDIT = { logAudit };
