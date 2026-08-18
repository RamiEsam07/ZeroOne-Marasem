/* ZEROONE MARASEM — Theme Controller v1.6.0 */
(function () {
  const KEY='marasem-theme';
  function applyTheme(theme){
    const dark=theme==='dark';
    document.body.classList.toggle('dark-mode',dark);
    document.documentElement.dataset.theme=dark?'dark':'light';
    const icons=[document.getElementById('theme-toggle-icon'),document.getElementById('mobile-theme-toggle-icon')];
    icons.forEach(i=>{if(i)i.className=dark?'fa-solid fa-sun':'fa-solid fa-moon';});
    const b=document.getElementById('theme-toggle'); if(b)b.title=dark?'الوضع النهاري':'الوضع الليلي';
    localStorage.setItem(KEY,dark?'dark':'light');
  }
  window.toggleTheme=()=>applyTheme(document.body.classList.contains('dark-mode')?'light':'dark');
  window.initMarasemTheme=()=>{let s=localStorage.getItem(KEY); if(!s)s=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'; applyTheme(s);};
  document.addEventListener('DOMContentLoaded',window.initMarasemTheme);
})();
