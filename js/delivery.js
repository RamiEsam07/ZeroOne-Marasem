/**
 * ZEROONE MARASEM — Delivery Engine (V1.4.0)
 */
import { markWhatsAppPrepared } from "./guests.js";

function buildInvitationMessage(guest, url) {
    const confCode = guest.confirmationCode || 'ZM-──────';
    const lines = [
        `مرحبًا ${guest.name} 👋`,
        ``,
        `لديك دعوة خاصة لحضور:`,
        `[${guest.eventName || 'مناسبة خاصة'}]`,
        ``,
        guest.eventDate ? `📅 ${guest.eventDate}` : '',
        guest.eventTime ? `🕐 ${guest.eventTime}` : '',
        guest.venue ? `📍 ${guest.venue}` : '',
        ``,
        `يمكنك فتح دعوتك وتأكيد الحضور من هنا:`,
        url,
        ``,
        `🔐 رمز التأكيد الخاّص بك:`,
        confCode,
        ``,
        `ننتظرك بكل سرور 🤍`,
        ``,
        `ZEROONE MARASEM`
    ];
    return lines.filter(Boolean).join('\n');
}

async function dispatchWhatsApp(guest) {
    if (!guest || !guest.phone) {
        showToast('لا يوجد رقم هاتف مسجل لهذا الضيف', 'error');
        return;
    }
    const cleanPhone = guest.phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
        showToast('رقم الهاتف غير صالح', 'error');
        return;
    }

    const url = generateInvitationUrl(guest.invitationToken || guest.id);
    const message = buildInvitationMessage(guest, url);
    const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    window.open(waLink, '_blank');

    try {
        await markWhatsAppPrepared(guest.invitationToken || guest.id);
        showToast('تم فتح واتساب — تم تحضير الرسالة بنجاح', 'success');
    } catch (e) {
        console.error("WhatsApp Dispatch Error:", e);
    }
}

function dispatchWhatsAppById(token) {
    const guest = (window.MARASEM_DATA?.getGuestsCache() || []).find(g => g.id === token);
    if (guest) dispatchWhatsApp(guest);
}

window.dispatchWhatsApp = dispatchWhatsApp;
window.dispatchWhatsAppById = dispatchWhatsAppById; 
