/* ZEROONE MARASEM — Presentation Demo v1.6.0; read-only, no Firestore writes. */
(function(){
 const sample=[['إجمالي الدعوات',150],['تم التسليم',132],['تم الفتح',108],['RSVP',87],['تم الدخول',64]];
 window.openDemoMode=function(){
  if(document.getElementById('demo-overlay'))return;
  const o=document.createElement('div'); o.id='demo-overlay'; o.className='demo-overlay';
  o.innerHTML=`<div class="demo-modal" dir="rtl" role="dialog" aria-modal="true"><button class="demo-close" onclick="closeDemoMode()" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button><div class="demo-kicker">ZEROONE · MARASEM</div><h2>تجربة المنصة كما يراها العميل</h2><p class="demo-subtitle">عرض توضيحي مستقل — لا يغيّر أي بيانات حقيقية.</p><div class="demo-stats">${sample.map(x=>`<div class="demo-stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div><div class="demo-flow"><div><span>01</span><b>إنشاء</b><small>دعوة شخصية</small></div><div><span>02</span><b>تسليم</b><small>WhatsApp</small></div><div><span>03</span><b>تفاعل</b><small>فتح + RSVP</small></div><div><span>04</span><b>وصول</b><small>Check-in</small></div></div><div class="demo-cta-row"><button class="demo-primary" onclick="closeDemoMode();switchTab('create')">ابدأ تجربة حقيقية <i class="fa-solid fa-arrow-left"></i></button><button class="demo-secondary" onclick="closeDemoMode()">العودة للوحة</button></div></div>`;
  document.body.appendChild(o); requestAnimationFrame(()=>o.classList.add('is-open')); o.addEventListener('click',e=>{if(e.target===o)closeDemoMode();});
 };
 window.closeDemoMode=function(){const o=document.getElementById('demo-overlay');if(!o)return;o.classList.remove('is-open');setTimeout(()=>o.remove(),180);};
})();
