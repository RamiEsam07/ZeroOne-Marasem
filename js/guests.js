/**
 * ZEROONE MARASEM — Guest Data Engine (admin side)
 * Firestore document ID = invitationToken. This is what lets the public
 * invitation page fetch exactly one guest by an unguessable ID while the
 * security rules forbid it from ever listing the collection.
 */
import { db } from "./firebase.js";
import { logAudit } from "./audit.js";
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit as fsLimit,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const guestsCollection = collection(db, "guests");

function buildPublicGuestPayload(guest, token, includeServerDefaults = false, includeTracking = true) {
    const payload = {
        name: guest.name || '',
        type: guest.type || 'Standard',
        eventName: guest.eventName || '',
        eventDate: guest.eventDate || '',
        eventTime: guest.eventTime || '',
        venue: guest.venue || '',
        locationUrl: guest.locationUrl || '',
        table: guest.table || '',
        parking: guest.parking || '',
        invitationToken: token
    };
    if (includeTracking) {
        payload.opened = guest.opened === true;
        payload.rsvpStatus = guest.rsvpStatus || 'pending';
        payload.confirmed = guest.confirmed === true;
        if (includeServerDefaults) {
            payload.openedAt = null;
            payload.pageViewedAt = null;
            payload.confirmedAt = null;
        } else {
            if (guest.openedAt) payload.openedAt = guest.openedAt;
            if (guest.pageViewedAt) payload.pageViewedAt = guest.pageViewedAt;
            if (guest.confirmedAt) payload.confirmedAt = guest.confirmedAt;
        }
    }
    return payload;
}

// State cache (admin dashboard realtime list)
let cachedGuests = [];
let activeUnsubscribe = null;
let currentPageSize = 200;

// Subscribe to Live Guest Realtime Snapshots (admin only — enforced by rules).
// Bounded by a limit + orderBy so we never silently pull the entire
// collection to the device for large events; call increasePageSize() to
// load more (used by the "load more" control in the guest list).
export function subscribeGuests(callback, pageSize = currentPageSize) {
    currentPageSize = pageSize;
    if (activeUnsubscribe) activeUnsubscribe();
    const q = query(guestsCollection, orderBy('createdAt', 'desc'), fsLimit(currentPageSize));
    activeUnsubscribe = onSnapshot(q, (snapshot) => {
        cachedGuests = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            invitationToken: docSnap.id,
            ...docSnap.data()
        }));
        if (typeof callback === 'function') callback(cachedGuests, snapshot.size >= currentPageSize);
    }, (error) => {
        console.error("Firestore Listen Error:", error);
        showToast('تعذر الاتصال بقاعدة البيانات. حاول مرة أخرى.', 'error');
    });
    return activeUnsubscribe;
}

export function increasePageSize(callback, step = 200) {
    return subscribeGuests(callback, currentPageSize + step);
}

export function getGuestsCache() {
    return cachedGuests;
}

// Checks for an existing guest with the same phone + event, to prevent
// accidental duplicates. Uses the realtime cache (already scoped to admin).
export function findPossibleDuplicate(phone, eventName) {
    const cleanPhone = sanitizePhoneNumber(phone || '');
    const cleanEvent = (eventName || '').trim().toLowerCase();
    if (!cleanPhone) return null;
    return cachedGuests.find(g =>
        sanitizePhoneNumber(g.phone) === cleanPhone &&
        (g.eventName || '').trim().toLowerCase() === cleanEvent
    ) || null;
}

// Add New Guest Record. Returns the invitationToken (= doc id).
export async function createGuestRecord(guestData, { allowDuplicate = false } = {}) {
    const { valid, errors, cleaned } = validateGuestInput(guestData);
    if (!valid) {
        const err = new Error("VALIDATION_ERROR");
        err.fieldErrors = errors;
        throw err;
    }

    if (!allowDuplicate) {
        const dup = findPossibleDuplicate(cleaned.phone, cleaned.eventName);
        if (dup) {
            const err = new Error("DUPLICATE_GUEST");
            err.existingGuest = dup;
            throw err;
        }
    }

    const token = generateInvitationToken();

    const payload = {
        name: cleaned.name,
        phone: cleaned.phone,
        email: (cleaned.email || '').trim(),
        type: cleaned.type || "Standard",
        style: cleaned.style || "Elegant Classic",

        eventName: (cleaned.eventName || '').trim(),
        eventDate: (cleaned.eventDate || '').trim(),
        eventTime: (cleaned.eventTime || '').trim(),
        venue: (cleaned.venue || '').trim(),
        locationUrl: (cleaned.locationUrl || '').trim(),

        table: (cleaned.table || '').trim(),
        parking: (cleaned.parking || '').trim(),

        invitationToken: token,

        // Delivery lifecycle — kept distinct rather than a single boolean,
        // see js/delivery.js for the state machine this represents.
        whatsappStatus: 'none',      // none | prepared | opened_app
        whatsappPreparedAt: null,
        emailStatus: 'none',         // none | prepared | sent | failed
        emailPreparedAt: null,
        emailSentAt: null,

        // legacy/simple flag some views still read for a quick glance
        delivered: false,
        deliveredAt: null,

        opened: false,
        openedAt: null,
        pageViewedAt: null,

        rsvpStatus: 'pending', // pending | confirmed | declined
        confirmed: false,
        confirmedAt: null,

        checkedIn: false,
        checkedInAt: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: window.MARASEM_AUTH?.getCurrentAdminName?.() || null
    };

    const batch = writeBatch(db);
    batch.set(doc(db, "guests", token), payload);
    batch.set(doc(db, "publicGuests", token), buildPublicGuestPayload(payload, token, true));
    await batch.commit();
    await logAudit('created', token, { name: payload.name, eventName: payload.eventName });
    return token;
}

export async function updateGuestRecord(token, updates) {
    const { valid, errors, cleaned } = validateGuestInput({ ...findGuestInCache(token), ...updates });
    if (!valid) {
        const err = new Error("VALIDATION_ERROR");
        err.fieldErrors = errors;
        throw err;
    }
    const current = { ...findGuestInCache(token), ...updates, name: cleaned.name, phone: cleaned.phone };
    const batch = writeBatch(db);
    batch.update(doc(db, "guests", token), {
        ...updates,
        name: cleaned.name,
        phone: cleaned.phone,
        updatedAt: serverTimestamp()
    });
    batch.set(doc(db, "publicGuests", token), buildPublicGuestPayload(current, token, false, false), { merge: true });
    await batch.commit();
    await logAudit('updated', token, {});
}

function findGuestInCache(token) {
    return cachedGuests.find(g => g.id === token) || {};
}

// Fetch single guest by token (admin authenticated read)
export async function fetchGuestByToken(token) {
    try {
        const docRef = doc(db, "guests", token);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, invitationToken: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error fetching guest:", error);
        return null;
    }
}

// Mark WhatsApp prepared (a link was generated/opened, NOT proof of delivery)
export async function markWhatsAppPrepared(token) {
    const docRef = doc(db, "guests", token);
    await updateDoc(docRef, {
        whatsappStatus: 'opened_app',
        whatsappPreparedAt: serverTimestamp(),
        delivered: false,
        updatedAt: serverTimestamp()
    });
    await logAudit('deliveryPrepared', token, { channel: 'whatsapp' });
}

export async function markEmailPrepared(token) {
    const docRef = doc(db, "guests", token);
    await updateDoc(docRef, {
        emailStatus: 'prepared',
        emailPreparedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    await logAudit('deliveryPrepared', token, { channel: 'email' });
}

export async function markEmailSent(token) {
    const docRef = doc(db, "guests", token);
    await updateDoc(docRef, {
        emailStatus: 'sent',
        emailSentAt: serverTimestamp(),
        delivered: true,
        deliveredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

export async function markEmailFailed(token) {
    const docRef = doc(db, "guests", token);
    await updateDoc(docRef, { emailStatus: 'failed', updatedAt: serverTimestamp() });
}

// Mark Guest Checked-In (idempotent — caller should check g.checkedIn first)
export async function markAsCheckedIn(token) {
    const docRef = doc(db, "guests", token);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().checkedIn) {
        const err = new Error("ALREADY_CHECKED_IN");
        throw err;
    }
    await updateDoc(docRef, {
        checkedIn: true,
        checkedInAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    await logAudit('checkedIn', token, {});
}

// Delete Guest Document (admin only — enforced in rules)
export async function deleteGuestRecord(token) {
    try {
        const docRef = doc(db, "guests", token);
        const batch = writeBatch(db);
        batch.delete(docRef);
        batch.delete(doc(db, "publicGuests", token));
        await batch.commit();
        await logAudit('deleted', token, {});
        showToast('تم حذف المدعو بنجاح', 'success');
    } catch (error) {
        console.error("Error deleting guest:", error);
        showToast('تعذر حذف المدعو', 'error');
        throw error;
    }
}

// Server-side search by phone or token — used by check-in when the guest
// isn't in the already-loaded page/cache. Falls back to cache first.
export async function findGuestByPhoneOrToken(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q) return null;

    // 1) exact token / doc id
    const byToken = await fetchGuestByToken(q);
    if (byToken) return byToken;

    // 2) cache lookup by phone or partial name (fast path, already realtime-synced)
    const cleanPhone = sanitizePhoneNumber(q);
    const cacheHit = cachedGuests.find(g =>
        (cleanPhone && sanitizePhoneNumber(g.phone) === cleanPhone) ||
        (g.name || '').toLowerCase().includes(q.toLowerCase())
    );
    if (cacheHit) return cacheHit;

    // 3) authenticated server query fallback (phone exact match)
    if (cleanPhone) {
        const qy = query(guestsCollection, where('phone', '==', cleanPhone), fsLimit(1));
        const snap = await getDocs(qy);
        if (!snap.empty) {
            const d = snap.docs[0];
            return { id: d.id, invitationToken: d.id, ...d.data() };
        }
    }
    return null;
}

window.MARASEM_DATA = {
    subscribeGuests,
    increasePageSize,
    getGuestsCache,
    findPossibleDuplicate,
    createGuestRecord,
    updateGuestRecord,
    fetchGuestByToken,
    markWhatsAppPrepared,
    markEmailPrepared,
    markEmailSent,
    markEmailFailed,
    markAsCheckedIn,
    deleteGuestRecord,
    findGuestByPhoneOrToken
};
