/**
 * ZEROONE MARASEM — Check-in Engine
 */
import { findGuestByPhoneOrToken, markAsCheckedIn, fetchGuestByToken } from "./guests.js";

async function performCheckin(token) {
    try {
        await markAsCheckedIn(token);
        showToast('تم تسجيل الوصول بنجاح ✦', 'success');
        return true;
    } catch (e) {
        if (e.message === 'ALREADY_CHECKED_IN') {
            showToast('⚠️ هذا الضيف قام بتسجيل الدخول مسبقاً', 'error');
        } else {
            showToast('تعذر تسجيل الدخول', 'error');
        }
        return false;
    }
}

async function searchForCheckin(rawQuery) {
    return findGuestByPhoneOrToken(rawQuery);
}

async function lookupByQrToken(token) {
    return fetchGuestByToken(token);
}

window.MARASEM_CHECKIN = { performCheckin, searchForCheckin, lookupByQrToken };
