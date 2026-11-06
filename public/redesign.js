(() => {
 const button = document.querySelector('.bo-menu-button');
 const menu = document.querySelector('.bo-mobile');
 if (!button || !menu) return;
 const close = () => { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-label', 'Open menu'); };
 button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; menu.hidden = !open; button.setAttribute('aria-expanded', String(open)); button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); });
 menu.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
 document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) { close(); button.focus(); } });
 document.addEventListener('click', event => { if (!event.target.closest('.bo-header')) close(); });
 window.matchMedia('(min-width: 901px)').addEventListener('change', event => { if(event.matches) close(); });
})();