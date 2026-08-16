/**
 * ZEROONE MARASEM — UI Controller & Platform App Logic
 */

let currentTab = 'create';
let rawGuestsList = [];
let hasMoreGuests = false;

// ---------------------------------------------------------------------------
// Boot — gated behind admin auth (see login.html / auth.js). Wrapped in
// DOMContentLoaded so the (deferred) auth.js module has already attached
// window.MARASEM_AUTH by the time this runs.
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    window.MARASEM_AUTH.guardAdminPage((user, role) => {
        applyRolePermissions(role);
        setLoadingState(true);

        if (window.MARASEM_DATA && window.MARASEM_DATA.subscribeGuests) {
            window.MARASEM_DATA.subscribeGuests((guests, more) => {
                setLoadingState(false);
                rawGuestsList = guests;
                hasMoreGuests = !!more;
                updateDashboardMetrics(guests);
                applyFiltersAndRender();
                renderLoadMoreControl();
            });
        }

        const nameEl = document.getElementById('admin-name-label');
        if (nameEl) nameEl.textContent = window.MARASEM_AUTH.getRoleLabel(role) + ' — ' + (window.MARASEM_AUTH.getCurrentAdminName() || '');

        updateLivePreview();
    });
});

function applyRolePermissions(role) {
    const can = window.MARASEM_AUTH.can;
    // Hide the "create invitation" tab entirely for roles that can't manage guests.
    if (!can('manageGuests')) {
        document.querySelectorAll('[data-requires="manageGuests"]').forEach(el => el.classList.add('hidden'));
    }
    if (!can('delivery')) {
        document.querySelectorAll('[data-requires="delivery"]').forEach(el => el.classList.add('hidden'));
    }
    if (!can('checkin')) {
        document.querySelectorAll('[data-requires="checkin"]').forEach(el => el.classList.add('hidden'));
    }
    if (!can('analytics')) {
        document.querySelectorAll('[data-requires="analytics"]').forEach(el => el.classList.add('hidden'));
    }
    // Land on the first available tab for this role.
    if (!can('manageGuests')) {
        const fallback = can('checkin') ? 'checkin' : (can('analytics') ? 'analytics' : 'delivery');
        switchTab(fallback);
    }
}

function setLoadingState(isLoading) {
    const grid = document.getElementById('delivery-cards-grid');
    if (isLoading && grid) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-taupe text-sm">
            <i class="fa-solid fa-spinner fa-spin text-xl mb-2 block"></i>
            جاري تحميل الضيوف...
        </div>`;
    }
}

async function handleLogout() {
    await window.MARASEM_AUTH.logoutAdmin();
    window.location.href = 'login.html';
}

// Tab Switcher Controller
function switchTab(tabName) {
    currentTab = tabName;

    document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active-tab'));
    const activeDesktopBtn = document.getElementById(`tab-btn-${tabName}`);
    if (activeDesktopBtn) activeDesktopBtn.classList.add('active-tab');

    document.querySelectorAll('[id^="mobile-tab-btn-"]').forEach(btn => {
        btn.classList.remove('bg-espresso', 'text-ivory');
        btn.classList.add('text-taupe');
    });
    const activeMobileBtn = document.getElementById(`mobile-tab-btn-${tabName}`);
    if (activeMobileBtn) {
        activeMobileBtn.classList.remove('text-taupe');
        activeMobileBtn.classList.add('bg-espresso', 'text-ivory');
    }

    document.querySelectorAll('.tab-content').forEach(sec => sec.classList.add('hidden'));
    const activeSection = document.getElementById(`sec-${tabName}`);
    if (activeSection) activeSection.classList.remove('hidden');

    if (tabName === 'checkin') startQrScanner('qr-reader', onQrScanResult);
    else stopQrScanner();
}

// Live Preview Form Update
function updateLivePreview() {
    const name = document.getElementById('field-name')?.value || '[اسم المدعو]';
    const type = document.getElementById('field-type')?.value || 'VIP';
    const eventName = document.getElementById('field-event-name')?.value || '[اسم المناسبة]';
    const date = document.getElementById('field-event-date')?.value || '[التاريخ]';
    const time = document.getElementById('field-event-time')?.value || '[الوقت]';
    const venue = document.getElementById('field-venue')?.value || '[المكان]';
    const table = document.getElementById('field-table')?.value || '[رقم الطاولة]';

    document.getElementById('prev-name').textContent = name;
    document.getElementById('prev-type').textContent = type;
    document.getElementById('prev-event').textContent = eventName;
    document.getElementById('prev-date').textContent = date;
    document.getElementById('prev-time').textContent = time;
    document.getElementById('prev-venue').textContent = venue;
    document.getElementById('prev-table').textContent = table ? `الطاولة: ${table}` : '';
}

function clearFieldErrors() {
    document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
    document.querySelectorAll('.field-error-border').forEach(el => el.classList.remove('field-error-border', 'border-rose-600'));
}

function showFieldErrors(errors) {
    clearFieldErrors();
    const fieldMap = { name: 'field-name', phone: 'field-phone', email: 'field-email', eventDate: 'field-event-date', locationUrl: 'field-location-url' };
    Object.entries(errors).forEach(([key, message]) => {
        const input = document.getElementById(fieldMap[key]);
        if (!input) return;
        input.classList.add('field-error-border', 'border-rose-600');
        const msg = document.createElement('p');
        msg.className = 'field-error-msg text-[11px] text-rose-700 mt-1';
        msg.textContent = message;
        input.parentElement.appendChild(msg);
    });
}

// Handle Form Submission
async function handleCreateInvitation(event) {
    event.preventDefault();
    if (!window.MARASEM_AUTH.can('manageGuests')) {
        showToast('لا تملك صلاحية إنشاء دعوات', 'error');
        return;
    }
    clearFieldErrors();

    const btn = document.getElementById('btn-submit-invitation');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-sm"></i> <span>جاري الإنشاء...</span>`;

    const guestData = {
        name: document.getElementById('field-name').value,
        phone: document.getElementById('field-phone').value,
        email: document.getElementById('field-email').value,
        type: document.getElementById('field-type').value,
        style: document.getElementById('field-style').value,
        eventName: document.getElementById('field-event-name').value.trim(),
        eventDate: document.getElementById('field-event-date').value.trim(),
        eventTime: document.getElementById('field-event-time').value.trim(),
        venue: document.getElementById('field-venue').value.trim(),
        locationUrl: document.getElementById('field-location-url').value.trim(),
        table: document.getElementById('field-table').value.trim(),
        parking: document.getElementById('field-parking').value.trim()
    };

    try {
        await window.MARASEM_DATA.createGuestRecord(guestData);
        showToast('تم إنشاء الدعوة بنجاح ✦', 'success');
        document.getElementById('create-invitation-form').reset();
        updateLivePreview();
        switchTab('delivery');
    } catch (error) {
        if (error.message === 'VALIDATION_ERROR') {
            showFieldErrors(error.fieldErrors);
            showToast('يرجى تصحيح الحقول المظللة', 'error');
        } else if (error.message === 'DUPLICATE_GUEST') {
            const proceed = await showConfirmModal({
                title: 'هذا الضيف موجود بالفعل',
                message: `يوجد ضيف بنفس رقم الهاتف والمناسبة (${escapeHTML(error.existingGuest.name)}). هل تريد إنشاء دعوة إضافية على أي حال؟`,
                confirmLabel: 'إنشاء على أي حال',
                cancelLabel: 'إلغاء'
            });
            if (proceed) {
                try {
                    await window.MARASEM_DATA.createGuestRecord(guestData, { allowDuplicate: true });
                    showToast('تم إنشاء الدعوة بنجاح ✦', 'success');
                    document.getElementById('create-invitation-form').reset();
                    updateLivePreview();
                    switchTab('delivery');
                } catch (e2) {
                    showToast('تعذر إنشاء الدعوة، يرجى المحاولة لاحقاً', 'error');
                }
            }
        } else {
            console.error(error);
            showToast('تعذر إنشاء الدعوة، يرجى المحاولة لاحقاً', 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>إنشاء تجربة الدعوة ✦</span>`;
    }
}

// Render Dashboard Statistics
function updateDashboardMetrics(guests) {
    const stats = window.MARASEM_ANALYTICS.computeGuestStats(guests);

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-delivered').textContent = stats.delivered;
    document.getElementById('stat-opened').textContent = stats.opened;
    document.getElementById('stat-confirmed').textContent = stats.confirmed;
    document.getElementById('stat-checkedin').textContent = stats.checkedIn;

    const rateDelivery = document.getElementById('rate-delivery');
    if (rateDelivery) {
        rateDelivery.textContent = `${stats.deliveryRate}%`;
        document.getElementById('bar-delivery').style.width = `${stats.deliveryRate}%`;
        document.getElementById('rate-open').textContent = `${stats.openRate}%`;
        document.getElementById('bar-open').style.width = `${stats.openRate}%`;
        document.getElementById('rate-rsvp').textContent = `${stats.rsvpRate}%`;
        document.getElementById('bar-rsvp').style.width = `${stats.rsvpRate}%`;
    }
    const rateAttendance = document.getElementById('rate-attendance');
    if (rateAttendance) {
        rateAttendance.textContent = `${stats.attendanceRate}%`;
        document.getElementById('bar-attendance').style.width = `${stats.attendanceRate}%`;
    }

    const catList = document.getElementById('category-breakdown-list');
    if (catList) {
        const breakdown = window.MARASEM_ANALYTICS.computeCategoryBreakdown(guests);
        catList.innerHTML = breakdown.map(({ type, count }) => `
            <div class="flex justify-between py-1 border-b border-taupe/10">
                <span>${escapeHTML(type)}</span>
                <span class="font-bold">${count}</span>
            </div>`).join('');
    }
}

function renderLoadMoreControl() {
    const el = document.getElementById('load-more-guests');
    if (!el) return;
    el.classList.toggle('hidden', !hasMoreGuests);
}

function loadMoreGuests() {
    if (window.MARASEM_DATA?.increasePageSize) {
        window.MARASEM_DATA.increasePageSize((guests, more) => {
            rawGuestsList = guests;
            hasMoreGuests = !!more;
            updateDashboardMetrics(guests);
            applyFiltersAndRender();
            renderLoadMoreControl();
        });
    }
}

// Apply Filters & Search in Delivery Center
function applyFiltersAndRender() {
    const searchQuery = document.getElementById('delivery-search')?.value.toLowerCase().trim() || '';
    const typeFilter = document.getElementById('filter-type')?.value || 'ALL';
    const statusFilter = document.getElementById('filter-status')?.value || 'ALL';

    let filtered = rawGuestsList.filter(g => {
        const matchesSearch = (g.name || '').toLowerCase().includes(searchQuery) ||
                              (g.phone || '').includes(searchQuery) ||
                              (g.id || '').toLowerCase().includes(searchQuery);
        const matchesType = (typeFilter === 'ALL') || (g.type === typeFilter);
        let matchesStatus = true;
        if (statusFilter === 'DELIVERED') matchesStatus = g.delivered;
        if (statusFilter === 'NOT_DELIVERED') matchesStatus = !g.delivered;
        if (statusFilter === 'CONFIRMED') matchesStatus = g.confirmed;
        if (statusFilter === 'CHECKED_IN') matchesStatus = g.checkedIn;
        return matchesSearch && matchesType && matchesStatus;
    });

    renderDeliveryCards(filtered);
    renderGuestsTable(filtered);
}

const applyFiltersDebounced = typeof debounce === 'function' ? debounce(applyFiltersAndRender, 250) : applyFiltersAndRender;

// Render Delivery Cards Grid
function renderDeliveryCards(guests) {
    const grid = document.getElementById('delivery-cards-grid');
    if (!grid) return;

    if (guests.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-taupe text-sm">
                <i class="fa-solid fa-folder-open text-2xl mb-2 block text-taupe/50"></i>
                لا توجد دعوات مسجلة تطابق محددات البحث.
            </div>`;
        return;
    }

    const canDeliver = window.MARASEM_AUTH.can('delivery');
    const canDelete = window.MARASEM_AUTH.can('deleteGuest');

    grid.innerHTML = guests.map(g => {
        const url = generateInvitationUrl(g.invitationToken || g.id);
        const waLabel = g.whatsappStatus === 'opened_app' ? 'WhatsApp Ready ✓' : 'WhatsApp';

        return `
        <div class="bg-warm-ivory/40 border border-taupe/20 p-5 rounded-lg space-y-4 hover:border-muted-gold/50 transition-colors flex flex-col justify-between">
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] tracking-wider uppercase border border-muted-gold/40 px-2 py-0.5 text-muted-gold font-semibold">${escapeHTML(g.type)}</span>
                    <span class="text-[10px] text-taupe">${escapeHTML(g.style || 'Classic')}</span>
                </div>
                <h4 class="font-garamond font-bold text-lg text-espresso">${escapeHTML(g.name)}</h4>
                <p class="text-xs text-taupe"><i class="fa-solid fa-phone text-[10px] ml-1"></i> ${escapeHTML(g.phone)}</p>
                ${g.email ? `<p class="text-xs text-taupe"><i class="fa-solid fa-envelope text-[10px] ml-1"></i> ${escapeHTML(g.email)}</p>` : ''}
            </div>

            <div class="grid grid-cols-2 gap-1.5 pt-3 border-t border-taupe/15 text-[10px]">
                <div class="p-1.5 rounded bg-ivory text-center border border-taupe/10">
                    <span class="text-taupe block">التسليم</span>
                    <span class="font-semibold ${g.delivered ? 'text-emerald-700' : 'text-taupe'}">${g.delivered ? '✓ ' + waLabel : 'لم يتم'}</span>
                </div>
                <div class="p-1.5 rounded bg-ivory text-center border border-taupe/10">
                    <span class="text-taupe block">الفتح</span>
                    <span class="font-semibold ${g.opened ? 'text-espresso' : 'text-taupe'}">${g.opened ? '✓ نعم' : 'لا'}</span>
                </div>
                <div class="p-1.5 rounded bg-ivory text-center border border-taupe/10">
                    <span class="text-taupe block">RSVP</span>
                    <span class="font-semibold ${g.confirmed ? 'text-emerald-700' : 'text-taupe'}">${g.confirmed ? '✓ مؤكد' : 'غير مؤكد'}</span>
                </div>
                <div class="p-1.5 rounded bg-ivory text-center border border-taupe/10">
                    <span class="text-taupe block">الوصول</span>
                    <span class="font-semibold ${g.checkedIn ? 'text-emerald-700' : 'text-taupe'}">${g.checkedIn ? '✓ وصل' : 'لم يصل'}</span>
                </div>
            </div>

            <div class="pt-2 space-y-2">
                ${canDeliver ? `
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="dispatchWhatsAppById('${g.id}')" class="bg-emerald-800 text-white py-2 px-3 rounded text-xs hover:bg-emerald-900 transition-colors flex items-center justify-center gap-1.5">
                        <i class="fa-brands fa-whatsapp text-sm"></i> WhatsApp
                    </button>
                    <button onclick="dispatchEmailById('${g.id}')" class="bg-espresso text-ivory py-2 px-3 rounded text-xs hover:bg-muted-gold hover:text-espresso transition-colors flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-envelope text-xs"></i> البريد
                    </button>
                </div>` : ''}
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="copyToClipboard('${url}')" class="border border-taupe/30 py-1.5 px-3 rounded text-[11px] hover:bg-warm-ivory transition-colors">
                        <i class="fa-solid fa-copy ml-1"></i> نسخ الرابط
                    </button>
                    <a href="${url}" target="_blank" class="border border-taupe/30 py-1.5 px-3 rounded text-[11px] text-center hover:bg-warm-ivory transition-colors">
                        <i class="fa-solid fa-arrow-up-right-from-square ml-1"></i> فتح الدعوة
                    </a>
                </div>
                <button onclick="openQrModal('${g.invitationToken || g.id}')" class="w-full border border-taupe/30 py-1.5 px-3 rounded text-[11px] hover:bg-warm-ivory transition-colors">
                    <i class="fa-solid fa-qrcode ml-1"></i> عرض QR
                </button>
            </div>
        </div>`;
    }).join('');
}

// Render Guest Table View
function renderGuestsTable(guests) {
    const tbody = document.getElementById('guests-table-body');
    const countLabel = document.getElementById('records-count');
    if (!tbody) return;

    if (countLabel) countLabel.textContent = `${guests.length} دعوة`;

    if (guests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-taupe text-xs">
            لا يوجد ضيوف حتى الآن. ابدأ بإضافة أول ضيف.
        </td></tr>`;
        return;
    }

    const canDeliver = window.MARASEM_AUTH.can('delivery');
    const canDelete = window.MARASEM_AUTH.can('deleteGuest');

    tbody.innerHTML = guests.map(g => {
        const url = generateInvitationUrl(g.invitationToken || g.id);
        return `
        <tr class="hover:bg-warm-ivory/30 transition-colors">
            <td class="p-3 font-semibold text-espresso">${escapeHTML(g.name)}</td>
            <td class="p-3 text-taupe">${escapeHTML(g.phone)}</td>
            <td class="p-3"><span class="px-1.5 py-0.5 border border-muted-gold/40 text-muted-gold rounded text-[10px]">${escapeHTML(g.type)}</span></td>
            <td class="p-3">${g.delivered ? '<span class="text-emerald-700">✓</span>' : '-'}</td>
            <td class="p-3">${g.opened ? '<span class="text-espresso">✓</span>' : '-'}</td>
            <td class="p-3">${g.confirmed ? '<span class="text-emerald-700">مؤكد</span>' : 'معلق'}</td>
            <td class="p-3">${g.checkedIn ? '<span class="text-emerald-700">تم</span>' : '-'}</td>
            <td class="p-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${canDeliver ? `<button onclick="dispatchWhatsAppById('${g.id}')" title="WhatsApp" class="text-emerald-700 hover:text-emerald-900"><i class="fa-brands fa-whatsapp"></i></button>
                    <button onclick="dispatchEmailById('${g.id}')" title="Email" class="text-espresso hover:text-muted-gold"><i class="fa-solid fa-envelope"></i></button>` : ''}
                    <a href="${url}" target="_blank" title="Preview" class="text-taupe hover:text-espresso"><i class="fa-solid fa-eye"></i></a>
                    ${canDelete ? `<button onclick="confirmDeleteGuest('${g.id}')" title="Delete" class="text-rose-700 hover:text-rose-900"><i class="fa-solid fa-trash-can"></i></button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function confirmDeleteGuest(token) {
    if (!window.MARASEM_AUTH.can('deleteGuest')) {
        showToast('لا تملك صلاحية حذف الضيوف', 'error');
        return;
    }
    const proceed = await showConfirmModal({
        title: 'حذف الضيف',
        message: 'هل أنت متأكد من حذف هذا الضيف؟ هذا الإجراء لا يمكن التراجع عنه.',
        confirmLabel: 'حذف نهائي',
        danger: true
    });
    if (proceed && window.MARASEM_DATA?.deleteGuestRecord) {
        window.MARASEM_DATA.deleteGuestRecord(token);
    }
}

// ---------------------------------------------------------------------------
// QR modal
// ---------------------------------------------------------------------------
function openQrModal(token) {
    const guest = (rawGuestsList || []).find(g => g.id === token);
    const name = guest?.name || 'دعوة خاصة';
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[60] bg-espresso/60 backdrop-blur-sm flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="bg-ivory max-w-xs w-full rounded-lg border border-taupe/20 shadow-2xl p-6 space-y-4 text-center" dir="rtl">
            <h3 class="font-garamond font-bold text-lg text-espresso">${escapeHTML(name)}</h3>
            <div id="qr-modal-canvas-holder" class="flex justify-center"></div>
            <p class="text-[11px] text-taupe">يحتوي هذا الرمز على رابط الدعوة الآمن فقط</p>
            <button data-action="close" class="w-full border border-taupe/30 py-2 rounded text-xs hover:bg-warm-ivory transition-colors">إغلاق</button>
        </div>`;
    document.body.appendChild(overlay);
    renderGuestQr(document.getElementById('qr-modal-canvas-holder'), token);
    overlay.addEventListener('click', (e) => {
        if (e.target?.dataset?.action === 'close' || e.target === overlay) overlay.remove();
    });
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------
async function performCheckinSearch() {
    const query = document.getElementById('checkin-search-input')?.value.trim();
    const resultBox = document.getElementById('checkin-result');
    if (!query) {
        showToast('يرجى إدخال الاسم أو رقم الهاتف أو ID الدعوة', 'error');
        return;
    }

    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `<div class="text-center py-4 text-taupe text-xs"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    const guest = await window.MARASEM_CHECKIN.searchForCheckin(query);
    renderCheckinResult(guest);
}

async function onQrScanResult(token) {
    stopQrScanner();
    const resultBox = document.getElementById('checkin-result');
    if (resultBox) resultBox.classList.remove('hidden');
    const guest = await window.MARASEM_CHECKIN.lookupByQrToken(token);
    renderCheckinResult(guest);
}

function renderCheckinResult(guest) {
    const resultBox = document.getElementById('checkin-result');
    if (!resultBox) return;

    if (!guest) {
        resultBox.innerHTML = `
            <div class="text-center py-4 text-rose-800 text-xs">
                <i class="fa-solid fa-triangle-exclamation text-xl mb-1 block"></i>
                لم يتم العثور على سجل مطابق للبحث.
            </div>`;
        return;
    }

    resultBox.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-garamond font-bold text-xl text-espresso">${escapeHTML(guest.name)}</h4>
                    <p class="text-xs text-taupe">${escapeHTML(guest.eventName)}</p>
                </div>
                <span class="px-2 py-0.5 border border-muted-gold/40 text-muted-gold text-[10px] uppercase font-bold">${escapeHTML(guest.type)}</span>
            </div>
            <div class="text-xs space-y-1 text-espresso border-y border-taupe/15 py-3">
                <p><strong>الطاولة:</strong> ${escapeHTML(guest.table || 'غير محددة')}</p>
                <p><strong>الموقف:</strong> ${escapeHTML(guest.parking || 'غير محدد')}</p>
                <p><strong>حالة RSVP:</strong> ${guest.confirmed ? '<span class="text-emerald-700">مؤكد الحضور</span>' : 'لم يحدد بعد'}</p>
            </div>
            <div id="checkin-action-area">
                ${guest.checkedIn
                    ? `<div class="bg-emerald-900/10 border border-emerald-700/30 text-emerald-800 p-3 rounded text-center text-xs font-semibold">✓ تم تسجيل الوصول مسبقاً</div>`
                    : `<button onclick="doCheckin('${guest.invitationToken || guest.id}')" class="w-full bg-espresso text-ivory py-3 rounded text-xs font-medium hover:bg-muted-gold hover:text-espresso transition-colors">اعتماد الدخول ✦</button>`
                }
            </div>
        </div>`;
}

async function doCheckin(token) {
    const success = await window.MARASEM_CHECKIN.performCheckin(token);
    if (success) {
        const guest = await window.MARASEM_CHECKIN.lookupByQrToken(token);
        renderCheckinResult(guest);
    }
}
