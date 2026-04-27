/**
 * nav.js — Navigation Component
 * Rahula College Media Unit Database
 *
 * Top bar groups:
 *   Staff:   Database | Duty ▾ | Stats ▾ | Admin ▾
 *   Student:            Stats ▾  (Leaderboard + Report Card, own profile only)
 *
 * Duty  ▾  →  Mark Duty · Schedule · Appeals · ↳ Swaps (sub-item)
 * Stats ▾  →  Leaderboard · Report Cards · Analytics · Notices · Monthly Summary
 * Admin ▾  →  Admin Panel · Add Student · Activity Log
 */
(function () {
  'use strict';

  const ROLE_META = {
    admin:  { label: '⚡ Admin',   color: '#f59e0b' },
    editor: { label: '✏️ Editor',  color: '#3b82f6' },
    viewer: { label: '👁 Viewer',  color: '#10b981' },
  };

  function getCurrentUser() {
    try { const r = sessionStorage.getItem('rcmu_admin'); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function getStudentUser() {
    try { const r = sessionStorage.getItem('rcmu_student'); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }

  function buildNavbar() {
    if (document.getElementById('top-nav')) return;

    const user    = getCurrentUser();
    const student = getStudentUser();
    const role    = user?.ADM_role || '';
    const page    = window.location.pathname.split('/').pop().split('?')[0] || 'index.html';

    const isAdmin  = role === 'admin';
    const isEditor = role === 'editor';
    const isViewer = role === 'viewer';
    const canEdit  = isAdmin || isEditor;
    const canMark  = isAdmin || isEditor || isViewer;
    const isStaff  = !!user;

    const groups = [];

    /* 1 — Database link (staff only) */
    if (isStaff) {
      groups.push({ type: 'link', href: 'index.html', icon: '🗄️', label: 'Database' });
    }

    /* 2 — Duty dropdown (staff only) */
    if (canMark) {
      const items = [];
      if (canMark) items.push({ href: 'duty-mark.html',     icon: '🗂',  label: 'Mark Duty' });
      if (canEdit) items.push({ href: 'duty-schedule.html', icon: '📅', label: 'Schedule' });
      if (canEdit) items.push({ href: 'duty-appeals.html',  icon: '📣', label: 'Appeals' });
      if (canEdit) items.push({ href: 'duty-swap.html',     icon: '🔄', label: 'Swaps', sub: true });
      groups.push({ type: 'group', icon: '📅', label: 'Duty', items });
    }

    /* 3 — Stats dropdown (staff + students) */
    if (isStaff || student) {
      const items = [
        { href: 'leaderboard.html',     icon: '🏆', label: 'Leaderboard' },
        { href: 'report-card.html',     icon: '📄', label: 'Report Cards' },
        { href: 'dept-analytics.html',  icon: '📊', label: 'Analytics' },
        { href: 'announcements.html',   icon: '📢', label: 'Notices' },
        { href: 'monthly-summary.html', icon: '📅', label: 'Monthly Summary' },
      ];
      if (canEdit) items.push({ href: 'attendance-report.html', icon: '📋', label: 'Attendance' });
      groups.push({ type: 'group', icon: '📈', label: 'Stats', items });
    }

    /* 4 — Admin dropdown (admin only) */
    if (isAdmin) {
      groups.push({
        type: 'group', icon: '⚙️', label: 'Admin',
        items: [
          { href: 'admin.html',        icon: '⚙️', label: 'Admin Panel' },
          { href: 'add.html',          icon: '➕', label: 'Add Student' },
          { href: 'Activity-log.html', icon: '🔍', label: 'Activity Log' },
        ],
      });
    }

    /* helpers */
    const isActive = href => page.toLowerCase() === href.toLowerCase();
    const groupActive = items => items.some(i => isActive(i.href));

    /* desktop html */
    const desktopHtml = groups.map(g => {
      if (g.type === 'link') {
        return `<a href="${g.href}" class="nav-link${isActive(g.href) ? ' active' : ''}"><span class="nav-icon">${g.icon}</span>${g.label}</a>`;
      }
      const act = groupActive(g.items);
      const itemsHtml = g.items.map(i =>
        `<a href="${i.href}" class="nav-dd-item${i.sub ? ' nav-dd-sub' : ''}${isActive(i.href) ? ' active' : ''}"><span>${i.icon}</span>${i.label}</a>`
      ).join('');
      return `<div class="nav-group${act ? ' active' : ''}">
        <button class="nav-group-btn${act ? ' active' : ''}" type="button">
          <span class="nav-icon">${g.icon}</span>${g.label}
          <svg class="nav-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="nav-dropdown">${itemsHtml}</div>
      </div>`;
    }).join('');

    /* mobile drawer html */
    const drawerHtml = groups.map(g => {
      if (g.type === 'link') {
        return `<a href="${g.href}" class="nav-link${isActive(g.href) ? ' active' : ''}"><span class="nav-icon">${g.icon}</span>${g.label}</a>`;
      }
      const act = groupActive(g.items);
      const itemsHtml = g.items.map(i =>
        `<a href="${i.href}" class="nav-link${i.sub ? ' nav-drawer-sub-indent' : ''} nav-drawer-sub${isActive(i.href) ? ' active' : ''}"><span class="nav-icon">${i.icon}</span>${i.label}</a>`
      ).join('');
      return `<div class="nav-drawer-section">
        <div class="nav-drawer-section-title${act ? ' active' : ''}">${g.icon} ${g.label}</div>
        ${itemsHtml}
      </div>`;
    }).join('');

    /* user area */
    const rm          = ROLE_META[role] || { label: role || 'Guest', color: '#64748b' };
    const dispUser    = user || student;
    const letter      = (user?.ADM_name || student?.fullname || '?').charAt(0).toUpperCase();
    const uname       = user?.ADM_Uname || student?.fullname || '';
    const rlabel      = user ? rm.label : student ? 'Student' : '';
    const rcolor      = user ? rm.color : '#06b6d4';
    const logoutCall  = `(window.doLogout||function(){sessionStorage.removeItem('rcmu_admin');sessionStorage.removeItem('rcmu_student');window.location.href='login.html';})()`;

    const userHtml = dispUser
      ? `<div class="nav-user">
           <div class="nav-avatar" style="background:${rcolor}22;color:${rcolor};border:1.5px solid ${rcolor}40">${letter}</div>
           <span class="nav-uname">${uname}</span>
           <span class="nav-role-chip" style="background:${rcolor}18;color:${rcolor};border:1px solid ${rcolor}35">${rlabel}</span>
         </div>
         <button class="nav-logout" onclick="${logoutCall}" type="button">Sign Out</button>`
      : `<a href="login.html" class="nav-link" style="white-space:nowrap">Sign In</a>`;

    const drawerUserHtml = dispUser
      ? `<div class="nav-drawer-user">
           <div class="nav-avatar" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;background:${rcolor}22;color:${rcolor};border:1.5px solid ${rcolor}40;flex-shrink:0">${letter}</div>
           <div style="flex:1;min-width:0">
             <div style="font-size:.84rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${user?.ADM_name || uname}</div>
             <div style="font-size:.68rem;color:${rcolor};margin-top:1px">${rlabel}</div>
           </div>
           <button class="nav-logout" style="margin-left:auto;font-size:.72rem;padding:5px 10px;flex-shrink:0" onclick="${logoutCall}" type="button">Sign Out</button>
         </div>`
      : '';

    /* inject nav */
    const nav = document.createElement('nav');
    nav.id = 'top-nav';
    nav.className = 'top-nav';
    nav.innerHTML = `<div class="nav-inner">
      <a href="${user ? 'index.html' : student ? 'student-portal.html' : 'login.html'}" class="nav-brand">
        <div class="nav-logos">
          <img src="Rahula_College_Crest.png" class="nav-logo" alt="Rahula College">
          <img src="Media Unit Original logo.png" class="nav-logo" alt="RCMU">
        </div>
        <div class="nav-brand-text">
          <span class="nav-brand-name">Rahula College</span>
          <span class="nav-brand-sub">Media Unit</span>
        </div>
      </a>
      <div class="nav-links" id="navLinksDesktop">${desktopHtml}</div>
      <div class="nav-right">${userHtml}</div>
      <button class="nav-hamburger" id="navHamburger" aria-label="Open menu" aria-expanded="false" type="button">
        <span></span><span></span><span></span>
      </button>
    </div>`;

    const drawer = document.createElement('div');
    drawer.id = 'navDrawer';
    drawer.className = 'nav-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = drawerUserHtml + drawerHtml;

    document.body.prepend(drawer);
    document.body.prepend(nav);

    /* hamburger */
    const ham = document.getElementById('navHamburger');
    ham?.addEventListener('click', () => {
      const open = drawer.classList.toggle('open');
      ham.classList.toggle('open', open);
      ham.setAttribute('aria-expanded', String(open));
    });
    drawer.querySelectorAll('a').forEach(l => l.addEventListener('click', () => {
      drawer.classList.remove('open'); ham?.classList.remove('open');
    }));
    document.addEventListener('click', e => {
      if (!drawer.classList.contains('open')) return;
      if (!nav.contains(e.target) && !drawer.contains(e.target)) {
        drawer.classList.remove('open'); ham?.classList.remove('open');
      }
    });

    /* desktop dropdowns */
    nav.querySelectorAll('.nav-group').forEach(grp => {
      const btn = grp.querySelector('.nav-group-btn');
      if (!btn) return;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const was = grp.classList.contains('open');
        nav.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
        if (!was) grp.classList.add('open');
      });
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#top-nav .nav-group'))
        nav.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      nav.querySelectorAll('.nav-group.open').forEach(g => g.classList.remove('open'));
      if (drawer.classList.contains('open')) { drawer.classList.remove('open'); ham?.classList.remove('open'); }
    });

    /* ripple */
    document.addEventListener('click', e => {
      const t = e.target.closest('button, .nav-link, .nav-dd-item, .secondary-link');
      if (!t) return;
      const r = document.createElement('span');
      r.className = 'ripple-fx';
      const rect = t.getBoundingClientRect();
      const s = Math.max(rect.width, rect.height);
      r.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX-rect.left-s/2}px;top:${e.clientY-rect.top-s/2}px`;
      t.appendChild(r);
      r.addEventListener('animationend', () => r.remove());
    });
  }

  /* expose globally so app.js delegate works */
  window.RCMU_buildNav = buildNavbar;

  /* auto-run */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNavbar);
  } else {
    buildNavbar();
  }

})();