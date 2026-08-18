/**
 * ZEROONE MARASEM — Analytics Engine
 * Pure calculation functions over the realtime guest cache. Loaded as a
 * plain script (no imports) so app.js can call it directly.
 */

function computeGuestStats(guests) {
    const total = guests.length;
    const whatsappReady = guests.filter(g => g.whatsappStatus && g.whatsappStatus !== 'none').length;
    const emailSent = guests.filter(g => g.emailStatus === 'sent').length;
    const delivered = guests.filter(g => g.emailStatus === 'sent').length;
    const opened = guests.filter(g => g.opened).length;
    const confirmed = guests.filter(g => g.confirmed).length;
    const declined = guests.filter(g => g.rsvpStatus === 'declined').length;
    const checkedIn = guests.filter(g => g.checkedIn).length;

    const openRate = delivered ? Math.round((opened / delivered) * 100) : 0;
    const rsvpRate = opened ? Math.round((confirmed / opened) * 100) : 0;
    const attendanceRate = confirmed ? Math.round((checkedIn / confirmed) * 100) : 0;
    const deliveryRate = total ? Math.round((delivered / total) * 100) : 0;

    return {
        total, whatsappReady, emailSent, delivered, opened, confirmed, declined, checkedIn,
        openRate, rsvpRate, attendanceRate, deliveryRate
    };
}

function computeCategoryBreakdown(guests, types = ['VIP', 'Executive', 'Standard', 'Guest of Honor']) {
    return types.map(t => ({
        type: t,
        count: guests.filter(g => g.type === t).length
    }));
}

window.MARASEM_ANALYTICS = { computeGuestStats, computeCategoryBreakdown };
