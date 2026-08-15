/**
 * ZEROONE MARASEM — Delivery Engine
 *
 * IMPORTANT — status honesty:
 * There is no WhatsApp Business API wired up here, so we can never *know*
 * whether a message was actually delivered. wa.me only opens a pre-filled
 * chat in WhatsApp; whether the admin actually taps send is outside our
 * control. So we deliberately track "WhatsApp Ready / Prepared" — never
 * "Delivered" — for that channel. Email uses EmailJS (client-side, no
 * backend) and DOES give us a real send confirmation, so emailSentAt is
 * only set after EmailJS confirms the send.
 *
 * EmailJS setup: sign up at https://www.emailjs.com, create an email
 * service + template, then fill in the three constants below.
 */
import { markWhatsAppPrepared, markEmailPrepared, markEmailSent, markEmailFailed } from "./guests.js";

// ---- Fill these in after creating an EmailJS account -----------------
const EMAILJS_PUBLIC_KEY = "YOUR_EMAILJS_PUBLIC_KEY";
const EMAILJS_SERVICE_ID = "YOUR_EMAILJS_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_EMAILJS_TEMPLATE_ID";
// ------------------------------------------------------------------------

let emailjsReady = false;
function ensureEmailJs() {
    if (emailjsReady) return true;
    if (typeof window.emailjs === 'undefined') {
        showToast('خدمة البريد الإلكتروني غير مهيأة (EmailJS)', 'error');
        return false;
    }
    if (EMAILJS_PUBLIC_KEY.startsWith('YOUR_')) {
        showToast('يرجى إدخال بيانات حساب EmailJS في js/delivery.js أولاً', 'error');
        return false;
    }
    window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
    emailjsReady = true;
    return true;
}

function buildInvitationMessage(guest, url) {
    const lines = [
        `دعوة خاصة من ZEROONE MARASEM ✦`,
        ``,
        `عزيزي/عزيزتي ${guest.name}،`,
        `يسرنا دعوتكم لحضور ${guest.eventName || 'مناسبتنا الخاصة'}.`,
        guest.eventDate ? `📅 ${guest.eventDate}${guest.eventTime ? ' — ' + guest.eventTime : ''}` : '',
        guest.venue ? `📍 ${guest.venue}` : '',
        ``,
        `لعرض دعوتكم الكاملة وتأكيد الحضور:`,
        url
    ];
    return lines.filter(Boolean).join('\n');
}

// ---- WhatsApp -----------------------------------------------------------
// Opens WhatsApp with a pre-filled message. This does NOT send anything on
// its own — the admin/staff member still has to press send inside WhatsApp.
async function dispatchWhatsApp(guest) {
    if (!guest || !guest.phone) {
        showToast('لا يوجد رقم هاتف مسجل لهذا الضيف', 'error');
        return;
    }
    const phone = sanitizePhoneNumber(guest.phone).replace(/^\+/, '');
    if (!phone) {
        showToast('رقم الهاتف غير صالح', 'error');
        return;
    }

    const url = generateInvitationUrl(guest.invitationToken || guest.id);
    const message = buildInvitationMessage(guest, url);
    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(waLink, '_blank');

    try {
        await markWhatsAppPrepared(guest.invitationToken || guest.id);
        showToast('تم فتح واتساب — الدعوة جاهزة للإرسال (WhatsApp Ready)', 'success');
    } catch (e) {
        console.error(e);
    }
}

// ---- Email ----------------------------------------------------------------
async function dispatchEmail(guest) {
    if (!guest || !guest.email) {
        showToast('لا يوجد بريد إلكتروني مسجل لهذا الضيف', 'error');
        return;
    }

    const token = guest.invitationToken || guest.id;
    const url = generateInvitationUrl(token);

    if (!ensureEmailJs()) {
        // Fall back to a mailto: link so the admin can still send manually.
        const subject = encodeURIComponent(`دعوة خاصة — ${guest.eventName || 'ZEROONE MARASEM'}`);
        const body = encodeURIComponent(buildInvitationMessage(guest, url));
        window.location.href = `mailto:${guest.email}?subject=${subject}&body=${body}`;
        try { await markEmailPrepared(token); } catch (e) { console.error(e); }
        return;
    }

    try {
        await markEmailPrepared(token);
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
            to_email: guest.email,
            to_name: guest.name,
            event_name: guest.eventName || '',
            event_date: guest.eventDate || '',
            event_time: guest.eventTime || '',
            venue: guest.venue || '',
            invitation_url: url
        });
        await markEmailSent(token);
        showToast('تم إرسال البريد الإلكتروني بنجاح ✓', 'success');
    } catch (err) {
        console.error('EmailJS send failed:', err);
        await markEmailFailed(token);
        showToast('تعذر إرسال البريد الإلكتروني', 'error');
    }
}

// ---- ID-based wrappers (used from rendered HTML onclick handlers) -------
function dispatchWhatsAppById(token) {
    const guest = (window.MARASEM_DATA?.getGuestsCache() || []).find(g => g.id === token);
    if (guest) dispatchWhatsApp(guest);
}

function dispatchEmailById(token) {
    const guest = (window.MARASEM_DATA?.getGuestsCache() || []).find(g => g.id === token);
    if (guest) dispatchEmail(guest);
}

window.dispatchWhatsApp = dispatchWhatsApp;
window.dispatchEmail = dispatchEmail;
window.dispatchWhatsAppById = dispatchWhatsAppById;
window.dispatchEmailById = dispatchEmailById;
