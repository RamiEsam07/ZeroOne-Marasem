/**
 * ZEROONE MARASEM — Guest & Event Data Engine (V1.4.0 Fixed)
 * Fully self-contained input cleaner and Batch Write handler.
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
const eventsCollection = collection(db, "events");

// Clean and sanitize phone number
export function sanitizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/[^0-9+]/g, '').trim();
}

// Generate dynamic invitation URL
export function generateInvitationUrl(token) {
    let origin = window.location.origin;
    let path = window.location.pathname;

    path = path.substring(0, path.lastIndexOf('/') + 1);

    if (path.includes('/invitation/')) {
        path = path.replace('/invitation/', '/');
    }

    return `${origin}${path}invitation/invitation.html?token=${encodeURIComponent(token)}`;
}

// Unguessable unique token
export function generateUniqueToken() {
    return 'ZM-' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

// Unique short confirmation code
export function generateConfirmationCode() {
    const chars = '0123456789';
    let code = 'ZM-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Build safe public projection stripping phone/email
function buildPublicGuestPayload(guest, token, confirmationCode) {
    return {
        name: guest.name || '',
        type: guest.type || 'Standard',
        eventId: guest.eventId || '',
        eventName: guest.eventName || '',
        eventDate: guest.eventDate || '',
        eventTime: guest.eventTime || '',
        venue: guest.venue || '',
        locationUrl: guest.locationUrl || '',
        table: guest.table || '',
        parking: guest.parking || '',
        invitationToken: token,
        confirmationCode: confirmationCode,
        opened: false,
        rsvpStatus: 'pending',
        confirmed: false,
        openedAt: null,
        pageViewedAt: null,
        confirmedAt: null
    };
}

let cachedGuests = [];
let cachedEvents = [];
let activeUnsubscribe = null;
let currentPageSize = 200;

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
    });
    return activeUnsubscribe;
}

export function increasePageSize(callback, step = 200) {
    return subscribeGuests(callback, currentPageSize + step);
}

export function getGuestsCache() { return cachedGuests; }
export function getEventsCache() { return cachedEvents; }

export async function createEventRecord(eventData) {
    const eventRef = doc(eventsCollection);
    const eventId = eventRef.id;

    const payload = {
        eventId: eventId,
        name: (eventData.name || '').trim(),
        type: eventData.type || 'زفاف',
        date: eventData.date || '',
        time: eventData.time || '',
        venue: (eventData.venue || '').trim(),
        locationUrl: (eventData.locationUrl || '').trim(),
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: window.MARASEM_AUTH?.getCurrentAdminName?.() || null
    };

    await setDoc(eventRef, payload);
    await logAudit('eventCreated', eventId, { name: payload.name });
    return eventId;
}

export async function fetchEvents() {
    try {
        const q = query(eventsCollection, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        cachedEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return cachedEvents;
    } catch (e) {
        console.error("Fetch Events Error:", e);
        return [];
    }
}

// MAIN FIX: Robust Create Guest
export async function createGuestRecord(guestData) {
    const nameClean = (guestData.name || '').trim();
    const phoneClean = sanitizePhone(guestData.phone);

    if (!nameClean) {
        throw new Error("NAME_REQUIRED");
    }
    if (!phoneClean) {
        throw new Error("PHONE_REQUIRED");
    }

    const token = generateUniqueToken();
    const confCode = generateConfirmationCode();

    const payload = {
        token: token,
        guestId: token,
        name: nameClean,
        phone: phoneClean,
        email: (guestData.email || '').trim(),
        guestType: guestData.type || "Standard",
        type: guestData.type || "Standard",
        style: guestData.style || "Elegant Classic",

        eventId: guestData.eventId || '',
        eventName: (guestData.eventName || '').trim(),
        eventDate: (guestData.eventDate || '').trim(),
        eventTime: (guestData.eventTime || '').trim(),
        venue: (guestData.venue || '').trim(),
        locationUrl: (guestData.locationUrl || '').trim(),

        table: (guestData.table || '').trim(),
        parking: (guestData.parking || '').trim(),

        invitationToken: token,
        confirmationCode: confCode,

        whatsappStatus: 'none',
        emailStatus: 'none',
        delivered: false,

        opened: false,
        openedAt: null,
        pageViewedAt: null,

        rsvpStatus: 'pending',
        confirmed: false,
        confirmedAt: null,

        checkedIn: false,
        checkedInAt: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: window.MARASEM_AUTH?.getCurrentAdminName?.() || null
    };

    const publicPayload = buildPublicGuestPayload(payload, token, confCode);

    const batch = writeBatch(db);
    batch.set(doc(db, "guests", token), payload);
    batch.set(doc(db, "publicGuests", token), publicPayload);
    await batch.commit();

    await logAudit('created', token, { name: payload.name, confirmationCode: confCode });
    return token;
}

export async function fetchGuestByToken(token) {
    try {
        const docRef = doc(db, "guests", token);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, invitationToken: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Fetch Guest Error:", error);
        return null;
    }
}

export async function markWhatsAppPrepared(token) {
    const docRef = doc(db, "guests", token);
    await updateDoc(docRef, {
        whatsappStatus: 'opened_app',
        delivered: true,
        updatedAt: serverTimestamp()
    });
    await logAudit('deliveryPrepared', token, { channel: 'whatsapp' });
}

export async function markAsCheckedIn(token) {
    const docRef = doc(db, "guests", token);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
        throw new Error("GUEST_NOT_FOUND");
    }
    if (snap.data().checkedIn) {
        const err = new Error("ALREADY_CHECKED_IN");
        err.guest = snap.data();
        throw err;
    }
    await updateDoc(docRef, {
        checkedIn: true,
        checkedInAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    await logAudit('checkedIn', token, {});
}

export async function deleteGuestRecord(token) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "guests", token));
    batch.delete(doc(db, "publicGuests", token));
    await batch.commit();
    await logAudit('deleted', token, {});
}

export async function findGuestByPhoneOrTokenOrCode(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q) return null;

    const cacheHit = cachedGuests.find(g =>
        g.id === q ||
        g.invitationToken === q ||
        (g.confirmationCode && g.confirmationCode.toLowerCase() === q.toLowerCase()) ||
        (g.phone && g.phone.includes(q)) ||
        (g.name && g.name.toLowerCase().includes(q.toLowerCase()))
    );
    if (cacheHit) return cacheHit;

    const byToken = await fetchGuestByToken(q);
    if (byToken) return byToken;

    return null;
}

window.generateInvitationUrl = generateInvitationUrl;
window.MARASEM_DATA = {
    subscribeGuests,
    increasePageSize,
    getGuestsCache,
    getEventsCache,
    createEventRecord,
    fetchEvents,
    createGuestRecord,
    fetchGuestByToken,
    markWhatsAppPrepared,
    markAsCheckedIn,
    deleteGuestRecord,
    findGuestByPhoneOrTokenOrCode
};
