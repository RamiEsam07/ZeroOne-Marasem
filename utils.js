/**
 * ZEROONE MARASEM — Utility Functions
 * Helper collection for security, formatting, validation, and UI notifications.
 * Loaded as a plain (non-module) script so its functions are globally
 * available to the other classic-script files (app.js, delivery.js, etc).
 */

// ---------------------------------------------------------------------------
// Security / formatting
// ---------------------------------------------------------------------------

// Escape HTML strings to prevent XSS Attacks
function escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Clean phone numbers to strict digit-only format, preserving a leading
// country code. Supports numbers already containing +249 (Sudan) as well
// as local numbers.
function sanitizePhoneNumber(phone) {
    if (!phone) return '';
    let digits = phone.toString().trim().replace(/[^\d+]/g, '');
    digits = digits.replace(/^00/, '+');
    if (digits.startsWith('+')) {
        return '+' + digits.slice(1).replace(/[^\d]/g, '');
    }
    // Local Sudanese mobile numbers (0XXXXXXXXX) -> +249XXXXXXXXX
    if (/^0\d{9}$/.test(digits)) {
        return '+249' + digits.slice(1);
    }
    return digits.replace(/[^\d]/g, '');
}

// Generates a URL-safe, cryptographically random invitation token.
// Used as the Firestore document ID for /guests — long and unguessable
// so the security rules can safely allow a public "get by exact ID".
function generateInvitationToken() {
    const bytes = new Uint8Array(24);
    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const b64 = btoa(String.fromCharCode(...bytes));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateInvitationUrl(token) {
    const base = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
    return `${base}invitations/invitation.html?token=${encodeURIComponent(token)}`;
}

function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALIDATION_MESSAGES = {
    nameRequired: 'اسم المدعو مطلوب',
    nameTooShort: 'الاسم قصير جداً',
    nameTooLong: 'الاسم طويل جداً',
    phoneRequired: 'رقم الهاتف مطلوب',
    phoneInvalid: 'رقم الهاتف غير صحيح',
    emailInvalid: 'صيغة البريد الإلكتروني غير صحيحة',
    dateInvalid: 'التاريخ غير صحيح',
    mapUrlInvalid: 'رابط الموقع يجب أن يكون رابط خرائط جوجل صحيح'
};

function validateGuestInput(data) {
    const errors = {};

    const name = (data.name || '').trim().replace(/\s+/g, ' ');
    if (!name) errors.name = VALIDATION_MESSAGES.nameRequired;
    else if (name.length < 2) errors.name = VALIDATION_MESSAGES.nameTooShort;
    else if (name.length > 100) errors.name = VALIDATION_MESSAGES.nameTooLong;

    const phone = sanitizePhoneNumber(data.phone || '');
    if (!phone) errors.phone = VALIDATION_MESSAGES.phoneRequired;
    else if (!/^\+?\d{8,15}$/.test(phone)) errors.phone = VALIDATION_MESSAGES.phoneInvalid;

    if (data.email && data.email.trim()) {
        const email = data.email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.email = VALIDATION_MESSAGES.emailInvalid;
        }
    }

    if (data.eventDate && data.eventDate.trim()) {
        const d = new Date(data.eventDate);
        if (isNaN(d.getTime())) errors.eventDate = VALIDATION_MESSAGES.dateInvalid;
    }

    if (data.locationUrl && data.locationUrl.trim()) {
        const url = data.locationUrl.trim();
        const isValidUrl = /^https?:\/\//i.test(url);
        const isMapsUrl = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
        if (!isValidUrl || !isMapsUrl) errors.locationUrl = VALIDATION_MESSAGES.mapUrlInvalid;
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
        cleaned: { ...data, name, phone }
    };
}

// ---------------------------------------------------------------------------
// Toast Notification Engine
// ---------------------------------------------------------------------------

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto px-5 py-3 rounded shadow-lg text-xs font-medium flex items-center gap-2 max-w-md ${
        type === 'error'
            ? 'bg-rose-900 text-ivory border border-rose-700'
            : type === 'success'
            ? 'bg-espresso text-ivory border border-muted-gold/40'
            : 'bg-warm-ivory text-espresso border border-taupe/30'
    }`;

    const icon = type === 'error'
        ? '<i class="fa-solid fa-circle-exclamation text-rose-400"></i>'
        : type === 'success'
        ? '<i class="fa-solid fa-circle-check text-muted-gold"></i>'
        : '<i class="fa-solid fa-info-circle text-taupe"></i>';

    toast.innerHTML = `${icon} <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ---------------------------------------------------------------------------
// Modal confirm — replaces confirm()/alert() with a themed dialog
// ---------------------------------------------------------------------------

function showConfirmModal({ title, message, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', danger = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[60] bg-espresso/60 backdrop-blur-sm flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="bg-ivory max-w-sm w-full rounded-lg border border-taupe/20 shadow-2xl p-6 space-y-4 text-center" dir="rtl">
                <h3 class="font-garamond font-bold text-lg text-espresso">${escapeHTML(title || 'تأكيد الإجراء')}</h3>
                <p class="text-xs text-taupe leading-relaxed">${escapeHTML(message || '')}</p>
                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button data-action="cancel" class="border border-taupe/30 py-2.5 rounded text-xs hover:bg-warm-ivory transition-colors">${escapeHTML(cancelLabel)}</button>
                    <button data-action="confirm" class="py-2.5 rounded text-xs font-semibold text-ivory transition-colors ${danger ? 'bg-rose-800 hover:bg-rose-900' : 'bg-espresso hover:bg-muted-gold hover:text-espresso'}">${escapeHTML(confirmLabel)}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            const action = e.target?.dataset?.action;
            if (action === 'confirm') {
                overlay.remove();
                resolve(true);
            } else if (action === 'cancel' || e.target === overlay) {
                overlay.remove();
                resolve(false);
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Copy to Clipboard fallback mechanism
// ---------------------------------------------------------------------------

function copyToClipboard(text, successMessage = 'تم نسخ الرابط بنجاح') {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => showToast(successMessage, 'success'))
            .catch(() => fallbackCopyTextToClipboard(text, successMessage));
    } else {
        fallbackCopyTextToClipboard(text, successMessage);
    }
}

function fallbackCopyTextToClipboard(text, successMessage) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast(successMessage, 'success');
        } else {
            showToast('تعذر نسخ الرابط', 'error');
        }
    } catch (err) {
        showToast('تعذر نسخ الرابط', 'error');
    }
    document.body.removeChild(textArea);
}

// ---------------------------------------------------------------------------
// Format Firestore or standard Timestamps
// ---------------------------------------------------------------------------

function formatDate(timestamp) {
    if (!timestamp) return 'غير محدد';
    let date;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) return 'غير محدد';
    return date.toLocaleDateString('ar-SD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
