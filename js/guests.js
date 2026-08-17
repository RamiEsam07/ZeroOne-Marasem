/**
 * ZEROONE MARASEM — Guest & Event Data Engine (V1.4.0)
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

export function generateInvitationUrl(token) {
    let origin = window.location.origin;
    let path = window.location.pathname;

    path = path.substring(0, path.lastIndexOf('/') + 1);

    if (path.includes('/invitation/')) {
        path = path.replace('/invitation/', '/');
    }

    return `${origin}${path}invitation/invitation.html?token=${encodeURIComponent(token)}`;
}

export function generateUniqueToken() {
    return 'ZM-' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateConfirmationCode() {
    const chars = '0123456789';
    let code = 'ZM-';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function buildPublicGuestPayload(guest, token, confirmationCode, includeServerDefaults = false) {
    const payload = {
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
        opened: guest.opened === true,
        rsvpStatus: guest.rsvpStatus || 'pending',
        confirmed: guest.confirmed === true
    };

    if (includeServerDefaults) {
        payload.openedAt = null;
        payload.pageViewedAt = null;
        payload.confirmedAt = null;
    }
    return payload;
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
        if (typeof callback === '
