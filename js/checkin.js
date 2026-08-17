/**
 * ZEROONE MARASEM — Check-in Engine (V1.4.0)
 */
import { findGuestByPhoneOrTokenOrCode, markAsCheckedIn, fetchGuestByToken } from "./guests.js";

async function performCheckin(token) {
    try {
        await markAsCheckedIn(token);
        showToast('تم اعتماد دخول الضيف بنجاح ✦', 'success');
        return true;
    } catch (e) {
        if (e.message === 'ALREADY_CHECKED_IN') {
            showToast('⚠️ تم تسجيل دخول هذا الضيف مسبقاً!', 'error');
        } else {
            showToast('تعذر تسجيل الدخول', 'error');
        }
        return false;
    }
}

async function searchForCheckin(rawQuery) {
    return findGuestByPhoneOrTokenOrCode(rawQuery);
}

async function lookupByQrToken(token) {
    return fetchGuestByToken(token);
}

window.MARASEM_CHECKIN = { performCheckin, searchForCheckin, lookupByQrToken };
