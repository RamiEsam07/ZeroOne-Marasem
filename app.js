/**
 * ZEROONE MARASEM — Application Controller V1.4.0
 */

let currentTab = 'create';
let rawGuestsList = [];
let hasMoreGuests = false;

document.addEventListener('DOMContentLoaded', () => {
    window.MARASEM_AUTH.guardAdminPage((user, role) => {
        applyRolePermissions(role);
        setLoadingState(true);

        // ====================================================
        // 🛠️ ربط الأحداث الرئيسية للنماذج والحقول (Event Listeners)
        // ====================================================

        // 1. ربط نموذج إنشاء الدعوة
        const invitationForm = document.getElementById('create-invitation-form');
        if (invitationForm) {
            invitationForm.addEventListener('submit', handleCreateInvitation);
        }

        // 2. ربط نموذج إضافة المناسبة
        const eventForm = document.getElementById('create-event-form');
        if (eventForm) {
            eventForm.addEventListener('submit', handleCreateEvent);
        }

        // 3. ربط القائمة المنسدلة للمناسبات عند التغيير
        const eventSelect = document.getElementById('field-event-select');
        if (eventSelect) {
            eventSelect.addEventListener('change', handleEventSelectChange);
        }

        // 4. ربط حقول الإدخال للتحديث اللحظي لكارت المعاينة
        const previewInputIds = [
            'field-name', 'field-type', 'field-event-name',
            'field-event-date', 'field-event-time', 'field-venue', 'field-table'
        ];
        previewInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', updateLivePreview);
                el.addEventListener('change', updateLivePreview);
            }
        });

        // ====================================================

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

        loadEventsDropdown();

        const nameEl = document.getElementById('admin-name-label');
        if (nameEl) nameEl.textContent = window.MARASEM_AUTH.getRoleLabel(role) + ' — ' + (window.MARASEM_AUTH.getCurrentAdminName() || '');

        updateLivePreview();
    });
});

function applyRolePermissions(role) {
    const can = window.MARASEM_AUTH.can;
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

    if (!can('manageGuests')) {
        const fallback = can('checkin') ? 'checkin' : 'analytics';
        switchTab(fallback);
    }
}

function setLoadingState(isLoading) {
    const grid = document.getElementById('delivery-cards-grid');
    if (isLoading && grid) {
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-taupe text-sm">
            <i class="fa-solid fa-spinner fa-spin text-xl mb-2 block"></i>
            جاري تحميل سجل الضيوف والمناسبات...
        </div>`;
    }
}

async function handleLogout() {
    try {
        await window.MARASEM_AUTH.logoutAdmin();
    } catch (error) {
        console.error('MARASEM LOGOUT ERROR:', error);
    } finally {
        window.location.replace('./login.html');
    }
}

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

    if (tabName === 'events') renderEventsList();
}

async function loadEventsDropdown() {
    const select = document.getElementById('field-event-select');
    if (!select) return;
    const events = await window.MARASEM_DATA.fetchEvents();
    select.innerHTML = `<option value="">-- اختر مناسبة أو أدخل بيانات يدوياً --</option>` +
        events.map(ev => `<option value="${ev.id}">${escapeHTML(ev.name)} (${ev.date})</option>`).join('');
}

async function handleEventSelectChange() {
    const select = document.getElementById('field-event-select');
    const eventId = select.value;
    if (!eventId) return;

    const events = window.MARASEM_DATA.getEventsCache();
    const target = events.find(e => e.id === eventId);
    if (target) {
        if (document.getElementById('field-event-name')) document.getElementById('field-event-name').value = target.name || '';
        if (document.getElementById('field-event-date')) document.getElementById('field-event-date').value = target.date || '';
        if (document.getElementById('field-event-time')) document.getElementById('field-event-time').value = target.time || '';
        if (document.getElementById('field-venue')) document.getElementById('field-venue').value = target.venue || '';
        if (document.getElementById('field-location-url')) document.getElementById('field-location-url').value = target.locationUrl || '';
        updateLivePreview();
    }
}

async function handleCreateEvent(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-event');
    if (btn) btn.disabled = true;

    const data = {
        name: document.getElementById('event-name-input')?.value || '',
        type: document.getElementById('event-type-input')?.value || '',
        date: document.getElementById('event-date-input')?.value || '',
        time: document.getElementById('event-time-input')?.value || '',
        venue: document.getElementById('event-venue-input')?.value || '',
        locationUrl: document.getElementById('event-location-url-input')?.value || ''
    };

    try {
        await window.MARASEM_DATA.createEventRecord(data);
        showToast('تمت إضافة المناسبة بنجاح ✦', 'success');
        document.getElementById('create-event-form')?.reset();
        await loadEventsDropdown();
        await renderEventsList();
    } catch (e) {
        console.error(e);
        showToast('تعذر حفظ المناسبة', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function renderEventsList() {
    const container = document.getElementById('events-list-container');
    if (!container) return;
    const events = await window.MARASEM_DATA.fetchEvents();
    if (events.length === 0) {
        container.innerHTML = `<p class="text-xs text-taupe text-center py-6">لا توجد مناسبات مسجلة حتى الآن.</p>`;
        return;
    }
    container.innerHTML = events.map(ev => `
        <div class="bg-ivory border border-taupe/20 p-4 rounded text-xs space-y-1">
            <div class="flex justify-between font-semibold text-espresso">
                <span>${escapeHTML(ev.name)}</span>
                <span class="text-muted-gold">${escapeHTML(ev.type || '')}</span>
            </div>
            <p class="text-taupe">📅 ${escapeHTML(ev.date || '-')} | 🕐 ${escapeHTML(ev.time || '-')} | 📍 ${escapeHTML(ev.venue || '-')}</p>
        </div>
    `).join('');
}

function updateLivePreview() {
    const name = document.getElementById('field-name')?.value || '[اسم المدعو]';
    const type = document.getElementById('field-type')?.value || 'VIP';
    const eventName = document.getElementById('field-event-name')?.value || '[اسم المناسبة]';
    const date = document.getElementById('field-event-date')?.value || '[التاريخ]';
    const time = document.getElementById('field-event-time')?.value || '[الوقت]';
    const venue = document.getElementById('field-venue')?.value || '[المكان]';
    const table = document.getElementById('field-table')?.value || '[رقم الطاولة]';

    if (document.getElementById('prev-name')) document.getElementById('prev-name').textContent = name;
    if (document.getElementById('prev-type')) document.getElementById('prev-type').textContent = type;
    if (document.getElementById('prev-event')) document.getElementById('prev-event').textContent = eventName;
    if (document.getElementById('prev-date')) document.getElementById('prev-date').textContent = date;
    if (document.getElementById('prev-time')) document.getElementById('prev-time').textContent = time;
    if (document.getElementById('prev-venue')) document.getElementById('prev-venue').textContent = venue;
    if (document.getElementById('prev-table')) document.getElementById('prev-table').textContent = table ? `الطاولة: ${table}` : '';
}

async function handleCreateInvitation(event) {
    event.preventDefault();
    if (!window.MARASEM_AUTH.can('manageGuests')) {
        showToast('لا تملك صلاحية إنشاء دعوات', 'error');
        return;
    }

    const btn = document.getElementById('btn-submit-invitation');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-sm"></i> <span>جاري إنشاء الدعوة...</span>`;
    }

    const guestData = {
        name: document.getElementById('field-name')?.value || '',
        phone: document.getElementById('field-phone')?.value || '',
        email: document.getElementById('field-email')?.value || '',
        type: document.getElementById('field-type')?.value || 'Standard',
        eventId: document.getElementById('field-event-select')?.value || '',
        eventName: (document.getElementById('field-event-name')?.value || '').trim(),
        eventDate: (document.getElementById('field-event-date')?.value || '').trim(),
        eventTime: (document.getElementById('field-event-time')?.value || '').trim(),
        venue: (document.getElementById('field-venue')?.value || '').trim(),
        locationUrl: (document.getElementById('field-location-url')?.value || '').trim(),
        table: (document.getElementById('field-table')?.value || '').trim(),
        parking: (document.getElementById('field-parking')?.value || '').trim()
    };

    try {
        await window.MARASEM_DATA.createGuestRecord(guestData);
        showToast('تم إنشاء الدعوة بنجاح ✦', 'success');
        document.getElementById('create-invitation-form')?.reset();
        updateLivePreview();
        switchTab('delivery');
    } catch (error) {
        console.error(error);
        showToast('تعذر إنشاء الدعوة، تحقق من البيانات والاتصال', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<span>إنشاء تجربة الدعوة ✦</span>`;
        }
    }
}

function updateDashboardMetrics(guests) {
    const stats = window.MARASEM_ANALYTICS.computeGuestStats(guests);

    if (document.getElementById('stat-total')) document.getElementById('stat-total').textContent = stats.total;
    if (document.getElementById('stat-delivered')) document.getElementById('stat-delivered').textContent = stats.delivered;
    if (document.getElementById('stat-opened')) document.getElementById('stat-opened').textContent = stats.opened;
    if (document.getElementById('stat-confirmed')) document.getElementById('stat-confirmed').textContent = stats.confirmed;
    if (document.getElementById('stat-checkedin')) document.getElementById('stat-checkedin').textContent = stats.checkedIn;
}

function renderLoadMoreControl() {
    const el = document.getElementById('load-more-guests');
    if (!el) return;
    el.classList.toggle('hidden', !hasMoreGuests);
}

function applyFiltersAndRender() {
    const searchQuery = document.getElementById('delivery-search')?.value.toLowerCase().trim() || '';
    const typeFilter = document.getElementById('filter-type')?.value || 'ALL';
    const statusFilter = document.getElementById('filter-status')?.value || 'ALL';

    let filtered = rawGuestsList.filter(g => {
        const matchesSearch = (g.name || '').toLowerCase().includes(searchQuery) ||
                              (g.phone || '').includes(searchQuery) ||
                              (g.confirmationCode || '').toLowerCase().includes(searchQuery) ||
                              (g.id || '').toLowerCase().includes(searchQuery);
        const matchesType = (typeFilter === 'ALL') || (g.type === typeFilter || g.guestType === typeFilter);
        let matchesStatus = true;
        if (statusFilter === 'DELIVERED') matchesStatus = g.delivered || g.whatsappStatus !== 'none';
        if (statusFilter === 'CONFIRMED') matchesStatus = g.confirmed;
        if (statusFilter === 'CHECKED_IN') matchesStatus = g.checkedIn;
        return matchesSearch && matchesType && matchesStatus;
    });

    renderDeliveryCards(filtered);
    renderGuestsTable(filtered);
}

function renderDeliveryCards(guests) {
    const grid = document.getElementById('delivery-cards-grid');
    if (!grid) return;

    if (guests.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full py-12 text-center text-taupe text-sm">
                <i class="fa-solid fa-folder-open text-2xl mb-2 block text-taupe/50"></i>
                لا توجد دعوات مسجلة تطابق التصفية والبحث.
            </div>`;
        return;
    }

    grid.innerHTML = guests.map(g => {
        const url = generateInvitationUrl(g.invitationToken || g.id);
        const code = g.confirmationCode || 'ZM-──────';

        return `
        <div class="bg-warm-ivory/40 border border-taupe/20 p-5 rounded-lg space-y-4 hover:border-muted-gold/50 transition-colors flex flex-col justify-between">
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] tracking-wider uppercase border border-muted-gold/40 px-2 py-0.5 text-muted-gold font-semibold">${escapeHTML(g.type || 'Standard')}</span>
                    <span class="text-[10px] text-espresso font-bold bg-muted-gold/20 px-2 py-0.5 rounded">${escapeHTML(code)}</span>
                </div>
                <h4 class="font-garamond font-bold text-lg text-espresso">${escapeHTML(g.name)}</h4>
                <p class="text-xs text-taupe"><i class="fa-solid fa-phone text-[10px] ml-1"></i> ${escapeHTML(g.phone)}</p>
            </div>

            <div class="grid grid-cols-2 gap-1.5 pt-3 border-t border-taupe/15 text-[10px]">
                <div class="p-1.5 rounded bg-ivory text-center border border-taupe/10">
                    <span class="text-taupe block">التسليم</span>
                    <span class="font-semibold ${g.delivered ? 'text-emerald-700' : 'text-taupe'}">${g.delivered ? '✓ مجهز' : 'لم يتم'}</span>
                </div>
                <div class="p-1.5 rounded bg-ivory text-center border border-taupe/10">
                    <span class="text-taupe block">RSVP</span>
                    <span class="font-semibold ${g.confirmed ? 'text-emerald-700' : 'text-taupe'}">${g.confirmed ? '✓ مؤكد' : 'معلق'}</span>
                </div>
            </div>

            <div class="pt-2 space-y-2">
                <button onclick="dispatchWhatsAppById('${g.id}')" class="w-full bg-emerald-800 text-white py-2 px-3 rounded text-xs hover:bg-emerald-900 transition-colors flex items-center justify-center gap-1.5">
                    <i class="fa-brands fa-whatsapp text-sm"></i> WhatsApp mssg
                </button>
                <div class="grid grid-cols-2 gap-2">
                    <button onclick="copyToClipboard('${url}')" class="border border-taupe/30 py-1.5 px-2 rounded text-[11px] hover:bg-warm-ivory transition-colors">
                        نسخ الرابط
                    </button>
                    <a href="${url}" target="_blank" class="border border-taupe/30 py-1.5 px-2 rounded text-[11px] text-center hover:bg-warm-ivory transition-colors">
                        معاينة
                    </a>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderGuestsTable(guests) {
    const tbody = document.getElementById('guests-table-body');
    if (!tbody) return;

    if (guests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-taupe text-xs">لا يوجد ضيوف تطابق محددات البحث.</td></tr>`;
        return;
    }

    tbody.innerHTML = guests.map(g => {
        const url = generateInvitationUrl(g.invitationToken || g.id);
        const code = g.confirmationCode || 'ZM-──────';
        return `
        <tr class="hover:bg-warm-ivory/30 transition-colors">
            <td class="p-3 font-semibold text-espresso">${escapeHTML(g.name)}</td>
            <td class="p-3 text-taupe">${escapeHTML(g.phone)}</td>
            <td class="p-3 text-espresso font-bold">${escapeHTML(code)}</td>
            <td class="p-3"><span class="px-1.5 py-0.5 border border-muted-gold/40 text-muted-gold rounded text-[10px]">${escapeHTML(g.type || 'Standard')}</span></td>
            <td class="p-3">${g.delivered ? '<span class="text-emerald-700">✓</span>' : '-'}</td>
            <td class="p-3">${g.opened ? '<span class="text-espresso">✓</span>' : '-'}</td>
            <td class="p-3">${g.confirmed ? '<span class="text-emerald-700">مؤكد</span>' : 'معلق'}</td>
            <td class="p-3">${g.checkedIn ? '<span class="text-emerald-700">وصل</span>' : '-'}</td>
            <td class="p-3 text-center">
                <button onclick="dispatchWhatsAppById('${g.id}')" title="WhatsApp" class="text-emerald-700 hover:text-emerald-900 ml-2"><i class="fa-brands fa-whatsapp"></i></button>
                <a href="${url}" target="_blank" title="Preview" class="text-taupe hover:text-espresso"><i class="fa-solid fa-eye"></i></a>
            </td>
        </tr>`;
    }).join('');
}

async function performCheckinSearch() {
    const query = document.getElementById('checkin-search-input')?.value.trim();
    const resultBox = document.getElementById('checkin-result');
    if (!query) {
        showToast('أدخل الاسم أو الهاتف أو رمز التأكيد', 'error');
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

    const code = guest.confirmationCode || 'ZM-──────';

    resultBox.innerHTML = `
        <div class="space-y-3">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-garamond font-bold text-xl text-espresso">${escapeHTML(guest.name)}</h4>
                    <p class="text-xs text-taupe">${escapeHTML(guest.eventName || '')}</p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-0.5 border border-muted-gold/40 text-muted-gold text-[10px] uppercase font-bold block mb-1">${escapeHTML(guest.type || 'Standard')}</span>
                    <span class="text-xs font-bold text-espresso bg-warm-ivory px-2 py-0.5 rounded">${escapeHTML(code)}</span>
                </div>
            </div>
            <div class="text-xs space-y-1 text-espresso border-y border-taupe/15 py-3">
                <p><strong>الطاولة:</strong> ${escapeHTML(guest.table || 'حسب التوجيه')}</p>
                <p><strong>حالة RSVP:</strong> ${guest.confirmed ? '<span class="text-emerald-700 font-bold">مؤكد الحضور</span>' : 'غير مؤكد'}</p>
            </div>
            <div id="checkin-action-area">
                ${guest.checkedIn
                    ? `<div class="bg-emerald-900/10 border border-emerald-700/30 text-emerald-800 p-3 rounded text-center text-xs font-semibold">✓ Already Checked In — تم الدخول مسبقاً</div>`
                    : `<button onclick="doCheckin('${guest.invitationToken || guest.id}')" class="w-full bg-espresso text-ivory py-3 rounded text-xs font-medium hover:bg-muted-gold hover:text-espresso transition-colors">اعتماد الدخول (CHECK IN) ✦</button>`
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
