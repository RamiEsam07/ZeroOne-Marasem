/**
 * ZEROONE MARASEM — QR Code Engine
 * Encodes ONLY the invitation token (or full invitation URL) — never a
 * name, phone, or table number — so a lost/photographed QR reveals nothing
 * about the guest on its own.
 *
 * Requires (loaded via CDN in index.html):
 *   - qrcode.js (generation)     https://cdn.jsdelivr.net/npm/qrcode@1.5.3
 *   - html5-qrcode (scanning)    https://unpkg.com/html5-qrcode
 */

// Renders a QR code into the given container element for a guest token.
function renderGuestQr(containerEl, token) {
    if (!containerEl || typeof QRCode === 'undefined') return;
    containerEl.innerHTML = '';
    const canvas = document.createElement('canvas');
    containerEl.appendChild(canvas);
    const url = generateInvitationUrl(token);
    QRCode.toCanvas(canvas, url, { width: 180, margin: 1, color: { dark: '#211C17', light: '#F7F3EA' } }, (err) => {
        if (err) console.error('QR render error:', err);
    });
}

// Downloadable QR as a data URL (used for "save QR" actions if needed).
async function getGuestQrDataUrl(token) {
    if (typeof QRCode === 'undefined') return null;
    const url = generateInvitationUrl(token);
    return QRCode.toDataURL(url, { width: 400, margin: 2 });
}

// --- Scanner --------------------------------------------------------------
let activeScanner = null;

function startQrScanner(elementId, onResult) {
    if (typeof Html5Qrcode === 'undefined') {
        showToast('مكتبة مسح QR غير متاحة', 'error');
        return;
    }
    stopQrScanner();
    activeScanner = new Html5Qrcode(elementId);
    activeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
            // Extract the token whether the QR holds a bare token or a full URL.
            let token = decodedText;
            try {
                const u = new URL(decodedText);
                token = u.searchParams.get('token') || decodedText;
            } catch (_) { /* not a URL, use as-is */ }
            if (typeof onResult === 'function') onResult(token);
        },
        () => { /* per-frame scan failure, ignore silently */ }
    ).catch(err => {
        console.error('QR scanner start failed:', err);
        showToast('تعذر تشغيل الكاميرا لمسح QR', 'error');
    });
}

function stopQrScanner() {
    if (activeScanner) {
        activeScanner.stop().catch(() => {});
        activeScanner.clear();
        activeScanner = null;
    }
}

window.renderGuestQr = renderGuestQr;
window.getGuestQrDataUrl = getGuestQrDataUrl;
window.startQrScanner = startQrScanner;
window.stopQrScanner = stopQrScanner;
