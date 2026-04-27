import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.18.5/package/xlsx.mjs";

const firebaseConfig = {
  apiKey: "AIzaSyAWnUyookTnBefjgoOZu6Lk3Fd-Fo_sZbo",
  authDomain: "rcmu-db.firebaseapp.com",
  projectId: "rcmu-db",
  storageBucket: "rcmu-db.firebasestorage.app",
  messagingSenderId: "1043134894673",
  appId: "1:1043134894673:web:dbd89dd271749cea6fde70",
  measurementId: "G-H9WBBXZ4GV"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db  = getFirestore(app);
let students   = [];
let viewMode   = "cards";
let searchQuery = "";
let sortOption  = "fullname";

// ── ROLES (no mod) ────────────────────────────────────────────
const ROLE_META = {
  admin:  { label:"⚡ Admin",  color:"#f59e0b", icon:"⚡" },
  editor: { label:"✏️ Editor", color:"#3b82f6", icon:"✏️" },
  viewer: { label:"👁 Viewer", color:"#10b981", icon:"👁" }
};

// ── AUTH ──────────────────────────────────────────────────────
function getCurrentUser() {
  try { const r = sessionStorage.getItem("rcmu_admin"); return r ? JSON.parse(r) : null; }
  catch { return null; }
}

function requireAuth(allowedRoles = []) {
  const user = getCurrentUser();
  if (!user) { window.location.href = "login.html"; return null; }
  if (allowedRoles.length && !allowedRoles.includes(user.ADM_role)) {
    window.location.href = "index.html";
    return null;
  }
  return user;
}

window.doLogout = function() {
  sessionStorage.removeItem("rcmu_admin");
  window.location.href = "login.html";
};

// ── NAVBAR INJECTION ──────────────────────────────────────────
function buildNavbar() {
  if (document.getElementById("top-nav")) return;

  const user    = getCurrentUser();
  const student = (function(){ try{ const s=sessionStorage.getItem("rcmu_student"); return s?JSON.parse(s):null; }catch(e){return null;} })();
  const role    = user?.ADM_role || "";
  const page    = window.location.pathname.split("/").pop().split("?")[0] || "index.html";

  const isAdmin  = role === "admin";
  const isEditor = role === "editor";
  const isViewer = role === "viewer";
  const canEdit  = isAdmin || isEditor;
  const canMark  = isAdmin || isEditor || isViewer;
  const isStaff  = !!user;

  function isActive(href) { return page.toLowerCase() === href.toLowerCase(); }

  // ── Define sections ────────────────────────────────────────
  const sections = [];

  if (isStaff) {
    sections.push({ id:"database", icon:"🗄️", label:"Database", href:"index.html", direct:true });
  }

  if (canMark) {
    const sub = [];
    if (canMark) sub.push({ href:"duty-mark.html",     icon:"🗂",  label:"Mark Duty" });
    if (canEdit) sub.push({ href:"duty-schedule.html", icon:"📅", label:"Schedule" });
    if (canEdit) sub.push({ href:"duty-appeals.html",  icon:"📣", label:"Appeals" });
    if (canEdit) sub.push({ href:"duty-swap.html",     icon:"🔄", label:"Swaps", indent:true });
    sections.push({ id:"duty", icon:"📅", label:"Duty", sub });
  }

  if (isStaff || student) {
    const sub = [
      { href:"leaderboard.html",     icon:"🏆", label:"Leaderboard" },
      { href:"report-card.html",     icon:"📄", label:"Report Cards" },
    ];
    if (isStaff) {
      sub.push({ href:"dept-analytics.html",  icon:"📊", label:"Analytics" });
      sub.push({ href:"announcements.html",   icon:"📢", label:"Notices" });
      sub.push({ href:"monthly-summary.html", icon:"📅", label:"Monthly" });
    }
    if (canEdit) sub.push({ href:"attendance-report.html", icon:"📋", label:"Attendance" });
    sections.push({ id:"stats", icon:"📈", label:"Stats", sub });
  }

  if (isAdmin) {
    sections.push({ id:"admin", icon:"⚙️", label:"Admin", sub:[
      { href:"admin.html",        icon:"⚙️", label:"Admin Panel" },
      { href:"add.html",          icon:"➕", label:"Add Student" },
      { href:"Activity-log.html", icon:"🔍", label:"Activity Log" },
    ]});
  }

  // ── Detect active section from current page ────────────────
  function findActiveSection() {
    for (const s of sections) {
      if (s.direct && isActive(s.href)) return s.id;
      if (s.sub && s.sub.some(l => isActive(l.href))) return s.id;
    }
    return null;
  }
  let activeSection = findActiveSection();

  // ── User area HTML ─────────────────────────────────────────
  const rm         = ROLE_META[role] || { color:"#64748b", label:role };
  const dispUser   = user || student;
  const letter     = (user?.ADM_name || student?.fullname || "?").charAt(0).toUpperCase();
  const uname      = user?.ADM_Uname || student?.fullname || "";
  const rlabel     = user ? rm.label : student ? "Student" : "";
  const rcolor     = user ? rm.color : "#06b6d4";
  const logoutCall = "(window.doLogout||function(){sessionStorage.removeItem('rcmu_admin');sessionStorage.removeItem('rcmu_student');window.location.href='login.html';})()";

  const userHtml = dispUser ? `
    <div class="nav-user" title="${user?.ADM_name||uname} — ${rlabel}">
      <div class="nav-avatar" style="background:${rcolor}22;color:${rcolor};border:1.5px solid ${rcolor}40">${letter}</div>
      <span class="nav-uname">${uname}</span>
      <span class="nav-role-chip" style="background:${rcolor}18;color:${rcolor};border:1px solid ${rcolor}35">${rlabel}</span>
    </div>
    <button class="nav-logout" onclick="${logoutCall}"><span>Sign Out</span></button>
  ` : `<a href="login.html" class="nav-link">Sign In</a>`;

  const drawerUserHtml = dispUser ? `
    <div class="nav-drawer-user">
      <div class="nav-avatar" style="background:${rcolor}22;color:${rcolor};border:1.5px solid ${rcolor}40;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700">${letter}</div>
      <div>
        <div style="font-size:.83rem;font-weight:700;color:var(--text)">${user?.ADM_name||uname}</div>
        <div style="font-size:.68rem;color:${rcolor}">${rlabel}</div>
      </div>
      <button class="nav-logout" style="margin-left:auto;font-size:.72rem;padding:5px 10px" onclick="${logoutCall}">Sign Out</button>
    </div>
  ` : "";

  // ── Main nav buttons HTML ──────────────────────────────────
  const mainLinksHtml = sections.map(s => {
    const isCur = s.id === activeSection;
    if (s.direct) {
      return `<a href="${s.href}" class="nav-link${isActive(s.href)?" active":""}" data-section="${s.id}">
        <span class="nav-icon">${s.icon}</span>${s.label}
      </a>`;
    }
    return `<button class="nav-link nav-section-btn${isCur?" active":""}" data-section="${s.id}" type="button">
      <span class="nav-icon">${s.icon}</span>${s.label}
      <svg class="nav-section-caret" width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;
  }).join("");

  // ── Sub-nav HTML (all sections, shown/hidden by JS) ────────
  const subNavContent = sections.filter(s => s.sub).map(s => {
    const subLinks = s.sub.map(l => {
      const ind = l.indent ? " sub-nav-indent" : "";
      return `<a href="${l.href}" class="sub-nav-link${ind}${isActive(l.href)?" active":""}">
        <span>${l.icon}</span>${l.label}
      </a>`;
    }).join("");
    return `<div class="sub-nav-group" data-section="${s.id}" style="display:none">${subLinks}</div>`;
  }).join("");

  // ── Mobile drawer HTML — accordion groups ─────────────────
  const drawerLinksHtml = sections.map(s => {
    if (s.direct) {
      return `<a href="${s.href}" class="nav-link${isActive(s.href)?" active":""}"><span class="nav-icon">${s.icon}</span>${s.label}</a>`;
    }
    const hasActive = (s.sub||[]).some(l => isActive(l.href));
    const subLinks = (s.sub||[]).map(l => {
      const ind = l.indent ? " nav-link-indent" : "";
      return `<a href="${l.href}" class="nav-link${ind}${isActive(l.href)?" active":""}"><span class="nav-icon">${l.icon}</span>${l.label}</a>`;
    }).join("");
    return `<div class="nav-drawer-group${hasActive?" open":""}">
      <button class="nav-drawer-group-btn" type="button" data-group="${s.id}">
        <span>${s.icon} ${s.label}</span>
        <svg class="nav-drawer-caret" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 5L7 9L11 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="nav-drawer-group-items">${subLinks}</div>
    </div>`;
  }).join("");

  // ── Create elements ────────────────────────────────────────
  const nav = document.createElement("nav");
  nav.id = "top-nav";
  nav.className = "top-nav";
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="${user?"index.html":student?"student-portal.html":"login.html"}" class="nav-brand">
        <div class="nav-logos">
          <img src="Rahula_College_Crest.png" class="nav-logo" alt="Rahula">
          <img src="Media Unit Original logo.png" class="nav-logo" alt="RCMU">
        </div>
        <div class="nav-brand-text">
          <span class="nav-brand-name">Rahula College</span>
          <span class="nav-brand-sub">Media Unit</span>
        </div>
      </a>
      <div class="nav-links" id="navLinksDesktop">${mainLinksHtml}</div>
      <div class="nav-right">${userHtml}</div>
      <button class="nav-hamburger" id="navHamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;

  const subNav = document.createElement("nav");
  subNav.id = "sub-nav";
  subNav.className = "sub-nav" + (activeSection && findSection(activeSection)?.sub ? " sub-nav-visible" : "");
  subNav.innerHTML = `<div class="sub-nav-inner">${subNavContent}</div>`;

  const drawer = document.createElement("div");
  drawer.id = "navDrawer";
  drawer.className = "nav-drawer";
  drawer.innerHTML = drawerUserHtml + drawerLinksHtml;

  document.body.prepend(drawer);
  document.body.prepend(subNav);
  document.body.prepend(nav);

  // Show active section's sub-nav on load
  function findSection(id) { return sections.find(s => s.id === id); }

  function showSubNav(sectionId) {
    subNav.querySelectorAll(".sub-nav-group").forEach(g => {
      g.style.display = g.dataset.section === sectionId ? "flex" : "none";
    });
    const sec = findSection(sectionId);
    if (sec?.sub) {
      subNav.classList.add("sub-nav-visible");
      document.body.classList.add("has-sub-nav");
    } else {
      subNav.classList.remove("sub-nav-visible");
      document.body.classList.remove("has-sub-nav");
    }
    // Update active state on main buttons
    nav.querySelectorAll(".nav-section-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.section === sectionId);
    });
    activeSection = sectionId;
  }

  function hideSubNav() {
    subNav.classList.remove("sub-nav-visible");
    document.body.classList.remove("has-sub-nav");
    nav.querySelectorAll(".nav-section-btn").forEach(btn => btn.classList.remove("active"));
    activeSection = null;
  }

  // Init
  if (activeSection && findSection(activeSection)?.sub) {
    showSubNav(activeSection);
  }

  // Section button click
  nav.querySelectorAll(".nav-section-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (activeSection === btn.dataset.section && subNav.classList.contains("sub-nav-visible")) {
        hideSubNav();
      } else {
        showSubNav(btn.dataset.section);
      }
    });
  });

  // Close sub-nav clicking outside
  document.addEventListener("click", e => {
    if (!nav.contains(e.target) && !subNav.contains(e.target)) {
      // Don't hide if current page belongs to this section
      if (!findActiveSection()) hideSubNav();
    }
  });

  // Hamburger
  const ham = document.getElementById("navHamburger");
  ham?.addEventListener("click", () => {
    const open = drawer.classList.toggle("open");
    ham.classList.toggle("open", open);
  });

  // Accordion — one group open at a time
  drawer.addEventListener("click", e => {
    const btn = e.target.closest(".nav-drawer-group-btn");
    if (!btn) return;
    const group = btn.closest(".nav-drawer-group");
    const isOpen = group.classList.contains("open");
    // Close all groups
    drawer.querySelectorAll(".nav-drawer-group.open").forEach(g => g.classList.remove("open"));
    // Open clicked one if it was closed
    if (!isOpen) group.classList.add("open");
  });

  // Close drawer when a sub-link is clicked
  drawer.querySelectorAll(".nav-link:not(.nav-drawer-group-btn)").forEach(l =>
    l.addEventListener("click", () => { drawer.classList.remove("open"); ham?.classList.remove("open"); })
  );
  document.addEventListener("click", e => {
    if (!drawer.classList.contains("open")) return;
    if (!nav.contains(e.target) && !drawer.contains(e.target)) {
      drawer.classList.remove("open"); ham?.classList.remove("open");
    }
  });

  // Ripple
  document.addEventListener("click", e => {
    const target = e.target.closest("button, .nav-link, .sub-nav-link, .secondary-link");
    if (!target) return;
    const r = document.createElement("span");
    r.className = "ripple-fx";
    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
    target.appendChild(r);
    r.addEventListener("animationend", () => r.remove());
  });
}
// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  document.querySelector(".rcmu-toast")?.remove();
  const t = document.createElement("div");
  t.className = `rcmu-toast rcmu-toast-${type}`;
  t.innerHTML = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("rcmu-toast-visible"));
  setTimeout(() => { t.classList.remove("rcmu-toast-visible"); setTimeout(() => t.remove(), 400); }, 3200);
}
window.showToast = showToast;

// ── ACTION UNDO SYSTEM ────────────────────────────────────────
// Shows an undo toast with a countdown bar. Caller provides:
//   label    — human-readable description e.g. "Student deleted"
//   undoFn   — async function to reverse the action
//   timeout  — ms before action becomes permanent (default 7000)
const _undoQueue = [];
function showUndoToast(label, undoFn, timeout = 7000) {
  // Cancel any previous undo
  _undoQueue.forEach(u => clearTimeout(u.timer));
  _undoQueue.length = 0;

  document.querySelector(".rcmu-undo-toast")?.remove();

  const el = document.createElement("div");
  el.className = "rcmu-undo-toast";
  el.innerHTML = `
    <div class="undo-toast-content">
      <span class="undo-toast-label">${label}</span>
      <button class="undo-toast-btn" id="undoActionBtn">↩ Undo</button>
    </div>
    <div class="undo-toast-bar"><div class="undo-toast-bar-fill" id="undoBarFill"></div></div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("rcmu-undo-toast-visible"));

  // Animate countdown bar
  const fill = document.getElementById("undoBarFill");
  if (fill) {
    fill.style.transition = `width ${timeout}ms linear`;
    requestAnimationFrame(() => { fill.style.width = "0%"; });
  }

  let undone = false;
  const timer = setTimeout(() => {
    el.classList.remove("rcmu-undo-toast-visible");
    setTimeout(() => el.remove(), 400);
  }, timeout);

  document.getElementById("undoActionBtn")?.addEventListener("click", async () => {
    if (undone) return;
    undone = true;
    clearTimeout(timer);
    el.classList.remove("rcmu-undo-toast-visible");
    setTimeout(() => el.remove(), 400);
    try {
      await undoFn();
      showToast("↩ Action undone successfully.", "success");
    } catch(e) {
      showToast("❌ Undo failed. Please refresh.", "error");
      console.error("Undo error:", e);
    }
  });

  _undoQueue.push({ timer });
}
window.showUndoToast = showUndoToast;

// ── 2FA PIN SYSTEM ────────────────────────────────────────────
// Sensitive actions (delete student, bulk changes) require PIN confirmation.
// PIN is set per-session in sessionStorage. Admin must enter their password hash.
// Usage: await requirePinConfirm("Delete student?") — resolves true/false
function requirePinConfirm(actionLabel = "this action") {
  return new Promise(resolve => {
    document.getElementById("rcmuPinModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "rcmuPinModal";
    overlay.className = "popup-overlay";
    overlay.innerHTML = `
      <div class="popup-card" style="max-width:380px;padding:28px">
        <div style="text-align:center;margin-bottom:18px">
          <div style="font-size:2rem;margin-bottom:8px">🔐</div>
          <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--text)">Confirm Sensitive Action</div>
          <div style="font-size:.82rem;color:var(--text-muted);margin-top:6px">${actionLabel}</div>
          <div style="font-size:.75rem;color:var(--red);margin-top:4px">Re-enter your password to proceed.</div>
        </div>
        <div style="margin-bottom:14px">
          <label style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:6px">Password</label>
          <input type="password" id="pinInput" placeholder="Your admin password…"
            style="width:100%;padding:10px 12px;background:var(--bg-panel);border:1px solid var(--border-soft);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font-body);font-size:.9rem;outline:none">
        </div>
        <p id="pinMsg" style="font-size:.78rem;color:var(--red);min-height:18px;margin-bottom:10px;text-align:center"></p>
        <div style="display:flex;gap:10px">
          <button id="pinConfirmBtn" style="flex:1;padding:10px;border:none;border-radius:var(--radius-sm);background:linear-gradient(135deg,var(--red),#f97316);color:#fff;font-family:var(--font-body);font-size:.9rem;font-weight:700;cursor:pointer">Confirm</button>
          <button id="pinCancelBtn" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:none;color:var(--text-muted);font-family:var(--font-body);font-size:.9rem;cursor:pointer">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("popup-visible"));

    const close = (result) => {
      overlay.classList.remove("popup-visible");
      overlay.classList.add("popup-hiding");
      setTimeout(() => { overlay.remove(); }, 320);
      resolve(result);
    };

    const confirm = async () => {
      const pw = document.getElementById("pinInput")?.value || "";
      if (!pw) { document.getElementById("pinMsg").textContent = "⚠️ Enter your password."; return; }
      try {
        const hash = await window._sha256(pw);
        const user = getCurrentUser();
        const adminList = window.manualAdmins || [];
        const match = adminList.find(a => a.ADM_Uname === user?.ADM_Uname && a.ADM_password === hash);
        if (match) {
          close(true);
        } else {
          document.getElementById("pinMsg").textContent = "❌ Incorrect password.";
          document.getElementById("pinInput").value = "";
        }
      } catch(e) { document.getElementById("pinMsg").textContent = "❌ Verification error."; }
    };

    document.getElementById("pinConfirmBtn").addEventListener("click", confirm);
    document.getElementById("pinCancelBtn").addEventListener("click", () => close(false));
    document.getElementById("pinInput").addEventListener("keydown", e => { if (e.key === "Enter") confirm(); });
    overlay.addEventListener("click", e => { if (e.target === overlay) close(false); });
    setTimeout(() => document.getElementById("pinInput")?.focus(), 100);
  });
}
window.requirePinConfirm = requirePinConfirm;

// ── AUDIT LOG ─────────────────────────────────────────────────
async function writeAuditLog(action, targetId, targetName, details = "") {
  try {
    const user = getCurrentUser();
    await addDoc(collection(db, "RCMU_AuditLog"), {
      action, targetId: targetId||"", targetName: targetName||"", details,
      performedBy: user?.ADM_Uname||"system", performedByName: user?.ADM_name||"System",
      performedByRole: user?.ADM_role||"unknown", timestamp: new Date().toISOString()
    });
  } catch(e) { console.warn("Audit log:", e); }
}
window.writeAuditLog = writeAuditLog;

// ── UI HELPERS ────────────────────────────────────────────────
function showMessage(id, text, color = "#86efac") {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerText = text; el.style.color = color;
  el.style.opacity = "0"; el.style.transform = "translateY(6px)";
  requestAnimationFrame(() => {
    el.style.transition = "opacity 0.3s, transform 0.3s";
    el.style.opacity = "1"; el.style.transform = "translateY(0)";
  });
}

function getAdminUsers()  { return Array.isArray(window.manualAdmins) ? window.manualAdmins : []; }
function saveAdminUsers() { if (typeof window.saveManualAdmins === "function") window.saveManualAdmins(); }

function parseSearchFilter(value) {
  const n = value.toString().trim().toLowerCase();
  if (n.startsWith("grade "))      return { type:"grade",      value:n.slice(6).trim() };
  if (n.startsWith("department ")) return { type:"department", value:n.slice(11).trim() };
  return null;
}

// ── STUDENT DETAIL POPUP ──────────────────────────────────────
function openStudentPopup(s) {
  document.getElementById("studentPopup")?.remove();
  window.currentStudentDoc = s;

  const initials    = (s.fullname||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const statusClass = s.status?.toLowerCase()==="active" ? "status-active" : "status-inactive";
  const user        = getCurrentUser();
  const canEdit     = ["admin","editor"].includes(user?.ADM_role);
  const isAdmin     = user?.ADM_role === "admin";

  const overlay = document.createElement("div");
  overlay.id = "studentPopup";
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-card" id="popupCard">
      <div class="popup-glow"></div>
      <button class="popup-close" id="popupCloseBtn" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 1l16 16M17 1L1 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="popup-header">
        <div class="popup-avatar" style="${s.profileImageUrl?'padding:0;overflow:hidden':''}">${s.profileImageUrl?`<img src="${s.profileImageUrl}" alt="${s.fullname||''}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.style.display='none';this.parentNode.textContent='${initials}'">`:`${initials}`}</div>
        <div class="popup-header-info">
          <h2 class="popup-name">${s.fullname}</h2>
          ${s.nickname ? `<p class="popup-nickname">"${s.nickname}"</p>` : ""}
          <div class="popup-status-row">
            <span class="status-badge ${statusClass}">${s.status||"—"}</span>
            ${getDutyPercentageGraph(s.dutyPercentage, true)}
          </div>
        </div>
      </div>
      <div class="popup-divider"></div>
      <div class="popup-grid">
        <div class="popup-field popup-field-full popup-field-row">
          <div class="popup-mini-field"><span class="popup-label">Student ID</span><span class="popup-value">${s.studentId||"—"}</span></div>
          <div class="popup-mini-field"><span class="popup-label">Grade</span><span class="popup-value">${s.grade||"—"}</span></div>
          <div class="popup-mini-field"><span class="popup-label">Class</span><span class="popup-value">${s.studentClass||"—"}</span></div>
          <div class="popup-mini-field"><span class="popup-label">Points</span><span class="popup-value" style="color:var(--accent);font-weight:700">${s.dutyPoints??0}</span></div>
        </div>
        <div class="popup-field"><span class="popup-label">Role</span><span class="popup-value">${s.role||"—"}</span></div>
        <div class="popup-field"><span class="popup-label">Department</span><span class="popup-value">${s.department||"—"}</span></div>
        <div class="popup-field"><span class="popup-label">Age Category</span><span class="popup-value">${s.experienceLevel||"—"}</span></div>
        <div class="popup-field"><span class="popup-label">Duty %</span><span class="popup-value">${s.dutyPercentage!=null?s.dutyPercentage+"%":"—"}</span></div>
        <div class="popup-field"><span class="popup-label">Birthday</span><span class="popup-value">${s.birthday||"—"}</span></div>
        <div class="popup-field"><span class="popup-label">Joined Year</span><span class="popup-value">${s.joinedYear||"—"}</span></div>
        <div class="popup-field popup-field-full"><span class="popup-label">Email</span><span class="popup-value">${s.email||"—"}</span></div>
        <div class="popup-field"><span class="popup-label">Phone</span><span class="popup-value">${s.phone||"—"}</span></div>
        <div class="popup-field"><span class="popup-label">WhatsApp</span><span class="popup-value">${s.whatsapp||"—"}</span></div>
        <div class="popup-field popup-field-full"><span class="popup-label">Address</span><span class="popup-value">${s.address||"—"}</span></div>
        ${getDutyActivitiesHtml(s, isAdmin)}
        ${getAchievementsHtml(s, isAdmin)}
        ${s.profileImageUrl ? `<div class="popup-field popup-field-full"><span class="popup-label">Profile Image</span><img src="${s.profileImageUrl}" alt="Profile" class="popup-profile-img" onerror="this.style.display='none'"></div>` : ""}
      </div>
      ${canEdit ? `
      <div class="popup-actions">
        <button class="popup-action-btn" type="button" onclick="openPointsEditor()">⚡ Adjust Points</button>
        ${isAdmin ? `<button class="popup-action-btn" type="button" onclick="openStudentEditor()">Edit Details</button>` : ""}
        <button class="popup-action-btn" type="button" onclick="openDutyEditor()">Update Duty</button>
        <button class="popup-action-btn" type="button" onclick="openAchievementEditor()">Add Achievement</button>
        ${isAdmin ? `<button class="popup-action-btn" type="button" onclick="deleteSelectedHistory()">Delete Selected</button>` : ""}
        ${isAdmin ? `<button class="delete-confirm-btn" type="button" onclick="confirmDeleteStudent('${s._docId}','${(s.fullname||"").replace(/'/g,"\\'")}')">Delete Student</button>` : ""}
      </div>` : ""}
      <button class="popup-close-bottom" id="popupCloseBtnBottom">Close</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => overlay.classList.add("popup-visible"));

  const close = () => {
    overlay.classList.remove("popup-visible");
    overlay.classList.add("popup-hiding");
    setTimeout(() => { overlay.remove(); document.body.style.overflow = ""; }, 320);
  };

  document.getElementById("popupCloseBtn").addEventListener("click", close);
  document.getElementById("popupCloseBtnBottom").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function esc(e) { if (e.key==="Escape"){ close(); document.removeEventListener("keydown",esc); } });
}

// ── POINTS EDITOR ─────────────────────────────────────────────
window.openPointsEditor = function() {
  const student = window.currentStudentDoc;
  if (!student) return;
  const user = getCurrentUser();
  if (!["admin","editor"].includes(user?.ADM_role)) { showToast("⛔ Only admins/editors can adjust points.", "error"); return; }

  document.getElementById("pointsModal")?.remove();
  const cur = Number(student.dutyPoints) || 0;
  const initials = (student.fullname||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();

  const overlay = document.createElement("div");
  overlay.id = "pointsModal";
  overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup-card points-modal-card">
      <button class="popup-close" id="ptsClose" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 1l16 16M17 1L1 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="popup-header">
        <div class="popup-avatar" style="${s.profileImageUrl?'padding:0;overflow:hidden':''}">${s.profileImageUrl?`<img src="${s.profileImageUrl}" alt="${s.fullname||''}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.style.display='none';this.parentNode.textContent='${initials}'">`:`${initials}`}</div>
        <div class="popup-header-info">
          <h2 class="popup-name">Adjust Points</h2>
          <p class="popup-nickname">${student.fullname}</p>
        </div>
      </div>
      <div class="popup-divider"></div>
      <div class="pts-current-row">
        <span class="pts-current-label">Current balance</span>
        <span class="pts-current-value">${cur}</span>
        <span class="pts-current-unit">pts</span>
      </div>
      <div class="pts-presets">
        <button class="pts-preset-btn neg" onclick="setPointsDelta(-25)">−25</button>
        <button class="pts-preset-btn neg" onclick="setPointsDelta(-10)">−10</button>
        <button class="pts-preset-btn neg" onclick="setPointsDelta(-5)">−5</button>
        <button class="pts-preset-btn pos" onclick="setPointsDelta(5)">+5</button>
        <button class="pts-preset-btn pos" onclick="setPointsDelta(10)">+10</button>
        <button class="pts-preset-btn pos" onclick="setPointsDelta(25)">+25</button>
      </div>
      <div class="pts-form">
        <div class="pts-field">
          <label>Custom amount</label>
          <input id="pointsDelta" type="number" placeholder="e.g. −10 or 25">
        </div>
        <div class="pts-field">
          <label>Reason</label>
          <input id="pointsReason" placeholder="e.g. Bonus for event coverage">
        </div>
      </div>
      <div class="pts-preview" id="pointsPreview">New total: <strong>${cur} pts</strong></div>
      <div class="edit-admin-actions" style="margin-top:14px">
        <button class="edit-save-btn" onclick="confirmPointsAdjust()">Apply Changes</button>
        <button class="edit-cancel-btn" id="ptsCancel">Cancel</button>
      </div>
      <p id="pointsMsg" style="text-align:center;font-size:.82rem;min-height:20px;margin-top:10px;color:var(--text-muted)"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => overlay.classList.add("popup-visible"));

  document.getElementById("pointsDelta").addEventListener("input", () => {
    const delta = Number(document.getElementById("pointsDelta").value) || 0;
    const newT  = cur + delta;
    const prev  = document.getElementById("pointsPreview");
    prev.innerHTML = `New total: <strong>${newT} pts</strong>`;
    prev.style.color = delta>0?"var(--green)":delta<0?"var(--red)":"var(--text-muted)";
  });

  const close = () => {
    overlay.classList.remove("popup-visible"); overlay.classList.add("popup-hiding");
    setTimeout(() => { overlay.remove(); document.body.style.overflow = ""; }, 320);
  };
  document.getElementById("ptsClose").addEventListener("click", close);
  document.getElementById("ptsCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target===overlay) close(); });
};

window.setPointsDelta = v => { const el=document.getElementById("pointsDelta"); if(!el)return; el.value=v; el.dispatchEvent(new Event("input")); };

window.confirmPointsAdjust = async function() {
  const student = window.currentStudentDoc;
  if (!student) return;
  const delta   = Number(document.getElementById("pointsDelta")?.value) || 0;
  const reason  = (document.getElementById("pointsReason")?.value||"").trim();
  const msgEl   = document.getElementById("pointsMsg");
  if (!delta) { msgEl.style.color="var(--red)"; msgEl.textContent="⚠️ Enter a non-zero value."; return; }
  const newPts  = (Number(student.dutyPoints)||0) + delta;
  try {
    await updateDoc(doc(db,"RCMU_DB",student._docId), { dutyPoints: newPts });
    await addDoc(collection(db,"RCMU_DutyLogs"), {
      studentDocId:student._docId, studentId:student.studentId, studentName:student.fullname,
      grade:student.grade||"", department:student.department||"",
      date:new Date().toISOString().split("T")[0], period:"manual",
      type: delta>0?"bonus":"penalty", pointChange:delta,
      reason:reason||"Manual adjustment", timestamp:new Date().toISOString(),
      markedBy:getCurrentUser()?.ADM_Uname||"", markedByName:getCurrentUser()?.ADM_name||""
    });
    await writeAuditLog(delta>0?"POINTS_ADD":"POINTS_REMOVE", student._docId, student.fullname,
      `${delta>0?"+":""}${delta} pts — ${reason||"no reason"}`);
    if (window.currentStudentDoc) window.currentStudentDoc.dutyPoints = newPts;
    const oldPts = (Number(student.dutyPoints)||0);
    msgEl.style.color="var(--green)"; msgEl.textContent=`✅ Points updated to ${newPts}.`;
    setTimeout(() => {
      document.getElementById("pointsModal")?.remove(); document.body.style.overflow="";
      // Offer undo
      showUndoToast(`Points ${delta>0?'+':''}${delta} applied to ${student.fullname}`, async () => {
        await updateDoc(doc(db,"RCMU_DB",student._docId), { dutyPoints: oldPts });
        await writeAuditLog("UNDO_POINTS", student._docId, student.fullname, `Reverted to ${oldPts} pts`);
      }, 8000);
    }, 800);
  } catch(e) { msgEl.style.color="var(--red)"; msgEl.textContent="❌ Failed."; console.error(e); }
};

// ── ADMIN USER MODALS ─────────────────────────────────────────
window.openEditAdmin = function(adminId) {
  const admin = getAdminUsers().find(a=>a.id===adminId);
  if (!admin) return;
  document.getElementById("editAdminModal")?.remove();
  const rm   = ROLE_META[admin.ADM_role]||{color:"#64748b"};
  const overlay = document.createElement("div");
  overlay.id = "editAdminModal"; overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup-card edit-admin-card">
      <div class="popup-glow" style="background:radial-gradient(ellipse 60% 40% at 50% 0%,${rm.color}18 0%,transparent 70%)"></div>
      <button class="popup-close" id="editAdminClose" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1 1l16 16M17 1L1 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <div class="popup-header">
        <div class="popup-avatar" style="background:linear-gradient(135deg,${rm.color},${rm.color}99)">${admin.ADM_name.charAt(0).toUpperCase()}</div>
        <div class="popup-header-info"><h2 class="popup-name">Edit Administrator</h2><p class="popup-nickname">@${admin.ADM_Uname}</p></div>
      </div>
      <div class="popup-divider"></div>
      <div class="edit-admin-notice"><span>🔒</span> Username and email cannot be changed here.</div>
      <div class="edit-admin-form">
        <div class="edit-field"><label>Full Name</label><input id="editAdmName" value="${admin.ADM_name}" placeholder="Full Name"></div>
        <div class="edit-field"><label>Admin ID</label><input id="editAdmId" value="${admin.ADM_ID}" placeholder="Admin ID"></div>
        <div class="edit-field"><label>Role</label>
          <select id="editAdmRole">
            <option value="admin"  ${admin.ADM_role==="admin"?"selected":""}>⚡ Admin — full access</option>
            <option value="editor" ${admin.ADM_role==="editor"?"selected":""}>✏️ Editor — add/edit students</option>
            <option value="viewer" ${admin.ADM_role==="viewer"?"selected":""}>👁 Viewer — view & mark duty</option>
          </select>
        </div>
      </div>
      <div class="edit-admin-actions">
        <button class="edit-save-btn" onclick="saveEditAdmin('${adminId}')">Save Changes</button>
        <button class="edit-cancel-btn" id="editAdminCancel">Cancel</button>
        <button class="edit-delete-btn" onclick="confirmDeleteAdmin('${adminId}')">Delete</button>
      </div>
      <p id="editAdminMsg" style="text-align:center;font-size:.82rem;min-height:20px;margin-top:10px"></p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => overlay.classList.add("popup-visible"));
  const close = () => { overlay.classList.remove("popup-visible"); overlay.classList.add("popup-hiding"); setTimeout(()=>{overlay.remove();document.body.style.overflow="";},320); };
  document.getElementById("editAdminClose").addEventListener("click", close);
  document.getElementById("editAdminCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if(e.target===overlay) close(); });
};

window.saveEditAdmin = function(adminId) {
  const admins = getAdminUsers();
  const idx    = admins.findIndex(a=>a.id===adminId);
  if (idx===-1) return;
  const name = document.getElementById("editAdmName").value.trim();
  const admId= document.getElementById("editAdmId").value.trim();
  const role = document.getElementById("editAdmRole").value;
  if (!name||!admId||!role) { const m=document.getElementById("editAdminMsg"); if(m){m.textContent="⚠️ All fields required.";m.style.color="#fb7185";} return; }
  admins[idx] = { ...admins[idx], ADM_name:name, ADM_ID:admId, ADM_role:role };
  window.manualAdmins = admins; saveAdminUsers();
  const m=document.getElementById("editAdminMsg"); if(m){m.textContent="✅ Saved!";m.style.color="#86efac";}
  setTimeout(()=>{ document.getElementById("editAdminModal")?.remove(); document.body.style.overflow=""; renderAdmins(getAdminUsers()); updateAdminStats(); },800);
};

window.confirmDeleteAdmin = function(adminId) {
  const admin   = getAdminUsers().find(a=>a.id===adminId);
  if (!admin) return;
  const current = getCurrentUser();
  if (current?.ADM_Uname === admin.ADM_Uname) { showToast("⛔ Cannot delete your own account.","error"); return; }
  document.getElementById("deleteConfirmModal")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "deleteConfirmModal"; overlay.className = "popup-overlay";
  overlay.innerHTML = `
    <div class="popup-card delete-confirm-card">
      <div class="delete-icon-wrap"><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v6M14 11v6" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/></svg></div>
      <h3 class="delete-title">Remove Administrator?</h3>
      <p class="delete-desc">This will permanently remove <strong>${admin.ADM_name}</strong> from the system.</p>
      <div class="delete-actions">
        <button class="delete-confirm-btn" onclick="deleteAdmin('${adminId}')">Yes, Remove</button>
        <button class="delete-cancel-btn" id="delCancelBtn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay); document.body.style.overflow="hidden";
  requestAnimationFrame(() => overlay.classList.add("popup-visible"));
  const close=()=>{overlay.classList.remove("popup-visible");overlay.classList.add("popup-hiding");setTimeout(()=>{overlay.remove();document.body.style.overflow="";},320);};
  document.getElementById("delCancelBtn").addEventListener("click",close);
  overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
};

window.deleteAdmin = function(adminId) {
  window.manualAdmins = getAdminUsers().filter(a=>a.id!==adminId);
  saveAdminUsers();
  document.getElementById("deleteConfirmModal")?.remove(); document.body.style.overflow="";
  renderAdmins(getAdminUsers()); updateAdminStats();
  showToast("✅ Administrator removed.");
};

// ── STUDENT CRUD ──────────────────────────────────────────────
window.confirmDeleteStudent = function(docId, studentName="this student") {
  if (!confirm(`Permanently delete ${studentName}?`)) return;
  window.deleteStudent(docId);
};

window.confirmDeleteStudent = async function(docId, studentName="this student") {
  const confirmed = await requirePinConfirm(`Delete <strong>${studentName}</strong>? This cannot be undone without the undo window.`);
  if (!confirmed) return;
  window.deleteStudent(docId, studentName);
};

window.deleteStudent = async function(docId, studentName) {
  if (getCurrentUser()?.ADM_role !== "admin") { showToast("⛔ Only admins can delete students.","error"); return; }
  try {
    const s = students.find(x=>x._docId===docId);
    const snapData = s ? {...s} : null; // snapshot for undo
    await deleteDoc(doc(db,"RCMU_DB",docId));
    await writeAuditLog("DELETE_STUDENT",docId,s?.fullname||docId,"Student record deleted");
    document.getElementById("studentPopup")?.remove(); document.body.style.overflow="";

    // Offer undo for 7 seconds
    showUndoToast(`🗑 "${studentName||s?.fullname||'Student'}" deleted`, async () => {
      if (!snapData) throw new Error("No snapshot");
      const { _docId, ...restData } = snapData;
      // Restore with same docId using setDoc
      const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js");
      await setDoc(doc(db,"RCMU_DB",docId), { ...restData, _restoredAt: new Date().toISOString() });
      await writeAuditLog("UNDO_DELETE",docId,snapData?.fullname||docId,"Student record restored via undo");
    }, 8000);
  } catch(e) { showToast("❌ Could not delete student.","error"); console.error(e); }
};

window.openStudentEditor = function() {
  const student = window.currentStudentDoc;
  if (!student||!student._docId) return;
  if (getCurrentUser()?.ADM_role !== "admin") { showToast("⛔ Only admins can edit details.","error"); return; }
  window.location.href = `edit.html?id=${student._docId}`;
};

window.openDutyEditor = function() {
  const student = window.currentStudentDoc;
  if (!student) return;
  const activities = getDutyActivitiesList(student).map(e=>e.text).join("\n");
  const newActs    = window.prompt("Edit duty activities (one per line):", activities);
  if (newActs===null) return;
  const pctRaw = window.prompt("Duty completion % (0-100):", student.dutyPercentage??0);
  if (pctRaw===null) return;
  const pct = Number(pctRaw);
  if (isNaN(pct)||pct<0||pct>100) { showToast("⚠️ Invalid percentage.","error"); return; }
  const lines = newActs.split("\n").map(l=>l.trim()).filter(Boolean).map(text=>({text,createdAt:new Date().toISOString()}));
  window.saveDutyDetails(student._docId, lines, pct, true);
};

window.saveDutyDetails = async function(docId, activities, percentage, overwrite=false) {
  try {
    const current  = window.currentStudentDoc;
    const existing = getDutyActivitiesList(current);
    const updated  = Array.isArray(activities) ? (overwrite?activities:[...existing,...activities]) : (overwrite?[{text:activities,createdAt:new Date().toISOString()}]:[...existing,{text:activities,createdAt:new Date().toISOString()}]);
    await updateDoc(doc(db,"RCMU_DB",docId), { dutyActivities:updated, dutyPercentage:percentage, dutyUpdatedAt:new Date().toISOString() });
    if (window.currentStudentDoc) { window.currentStudentDoc.dutyActivities=updated; window.currentStudentDoc.dutyPercentage=percentage; }
    renderStudents(); showToast("✅ Duty details updated.");
  } catch(e) { showToast("❌ Update failed.","error"); console.error(e); }
};

window.openAchievementEditor = function() {
  const student = window.currentStudentDoc;
  if (!student) return;
  const text = window.prompt("Enter new achievement:")?.trim();
  if (!text) return;
  window.saveAchievementDetails(student._docId, text);
};

window.saveAchievementDetails = async function(docId, achievement) {
  try {
    const current  = window.currentStudentDoc;
    const existing = getAchievementsList(current);
    const updated  = [...existing, { text:achievement, createdAt:new Date().toISOString() }];
    await updateDoc(doc(db,"RCMU_DB",docId), { achievements:updated });
    if (window.currentStudentDoc) window.currentStudentDoc.achievements = updated;
    renderStudents(); showToast("✅ Achievement added.");
  } catch(e) { showToast("❌ Failed.","error"); console.error(e); }
};

window.deleteSelectedHistory = async function() {
  const student  = window.currentStudentDoc;
  if (!student) return;
  const selected = Array.from(document.querySelectorAll("#studentPopup .history-checkbox:checked"));
  if (!selected.length) { showToast("⚠️ Select items to delete.","error"); return; }
  const byType = {duty:[],achievement:[]};
  selected.forEach(el => { const t=el.dataset.entryType; const i=Number(el.dataset.entryIndex); if(!isNaN(i)&&byType[t]) byType[t].push(i); });
  const removeByIdx = (arr,idxs) => {
    const s=[...new Set(idxs)].sort((a,b)=>b-a);
    const copy=[...arr]; s.forEach(i=>{if(i>=0&&i<copy.length)copy.splice(i,1)}); return copy;
  };
  const updActs = removeByIdx(getDutyActivitiesList(student), byType.duty);
  const updAchs = removeByIdx(getAchievementsList(student),   byType.achievement);
  try {
    await updateDoc(doc(db,"RCMU_DB",student._docId), { dutyActivities:updActs, achievements:updAchs });
    if (window.currentStudentDoc) { window.currentStudentDoc.dutyActivities=updActs; window.currentStudentDoc.achievements=updAchs; }
    renderStudents(); openStudentPopup(window.currentStudentDoc); showToast("✅ Selected items deleted.");
  } catch(e) { showToast("❌ Failed.","error"); console.error(e); }
};

// ── ADMIN PAGE ────────────────────────────────────────────────
function updateAdminStats() {
  const counts = {admin:0,editor:0,viewer:0};
  getAdminUsers().forEach(a => { if(counts[a.ADM_role]!==undefined) counts[a.ADM_role]++; });
  const anim = (id,val) => { const el=document.getElementById(id);if(!el)return;let c=0;const t=()=>{c++;el.textContent=c;if(c<val)requestAnimationFrame(t);};val>0?requestAnimationFrame(t):el.textContent="0"; };
  anim("statAdmins",  counts.admin);
  anim("statEditors", counts.editor);
  anim("statViewers", counts.viewer);
  const total = document.getElementById("statTotal");
  if(total) total.textContent = counts.admin+counts.editor+counts.viewer;
}
window.updateAdminStats = updateAdminStats;

function renderAdmins(adminDocs) {
  const list = document.getElementById("adminListWrap");
  if (!list) return;
  if (!adminDocs.length) { list.innerHTML=`<div class="empty-state">No admin users found.</div>`; return; }
  const current = getCurrentUser();
  const sorted  = [...adminDocs].sort((a,b)=>{const o=["admin","editor","viewer"];return o.indexOf(a.ADM_role)-o.indexOf(b.ADM_role);});

  const roleVisual = {
    admin:  { icon:'⚡', gradient:'135deg,#f59e0b,#ef4444', glow:'rgba(245,158,11,0.25)', ring:'#f59e0b', label:'Admin',  desc:'Full Access' },
    editor: { icon:'✏️', gradient:'135deg,#3b82f6,#8b5cf6', glow:'rgba(59,130,246,0.22)',  ring:'#3b82f6', label:'Editor', desc:'Add & Edit'   },
    viewer: { icon:'👁',  gradient:'135deg,#10b981,#06b6d4', glow:'rgba(16,185,129,0.22)',  ring:'#10b981', label:'Viewer', desc:'View & Mark'  },
  };

  list.innerHTML = `
    <style>
      .adm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(290px,1fr)); gap:18px; margin-bottom:8px; }
      .adm-card { position:relative; border-radius:16px; overflow:hidden; background:var(--bg-card); border:1px solid var(--border); transition:transform .28s cubic-bezier(.22,1,.36,1), box-shadow .28s; cursor:default; }
      .adm-card:hover { transform:translateY(-5px) scale(1.013); box-shadow:0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px var(--adm-ring,#888); }
      .adm-card-top { position:relative; height:78px; display:flex; align-items:flex-end; padding:0 18px 12px; }
      .adm-card-bg { position:absolute; inset:0; opacity:.13; }
      .adm-card-shine { position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.07) 0%,transparent 60%); }
      .adm-avatar-wrap { position:relative; flex-shrink:0; }
      .adm-avatar { width:56px; height:56px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.2rem; font-weight:800; letter-spacing:-.02em; color:#fff; position:relative; z-index:1; box-shadow:0 4px 18px var(--adm-glow,rgba(0,0,0,.3)); border:2px solid rgba(255,255,255,.12); }
      .adm-avatar-ring { position:absolute; inset:-3px; border-radius:17px; border:2px solid var(--adm-ring,#888); opacity:.5; animation:adm-ring-pulse 2.8s ease-in-out infinite; }
      @keyframes adm-ring-pulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:.85;transform:scale(1.05)} }
      .adm-you { position:absolute; top:-6px; right:-6px; background:#f59e0b; color:#000; font-size:.55rem; font-weight:800; letter-spacing:.06em; padding:2px 6px; border-radius:20px; text-transform:uppercase; z-index:2; animation:adm-ring-pulse 2s ease-in-out infinite; }
      .adm-role-pill { margin-left:auto; display:flex; align-items:center; gap:5px; padding:5px 11px; border-radius:20px; font-size:.7rem; font-weight:700; letter-spacing:.07em; text-transform:uppercase; border:1px solid rgba(255,255,255,.1); backdrop-filter:blur(4px); background:rgba(0,0,0,.4); color:#fff; position:relative; z-index:1; }
      .adm-role-dot { width:6px; height:6px; border-radius:50%; animation:adm-ring-pulse 2s ease-in-out infinite; }
      .adm-card-body { padding:14px 18px 16px; }
      .adm-name { font-size:.98rem; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; margin-bottom:4px; }
      .adm-username { font-size:.75rem; font-weight:600; opacity:.85; }
      .adm-divider { height:1px; background:var(--border); margin:10px 0; }
      .adm-meta-row { display:flex; align-items:center; gap:7px; font-size:.72rem; color:var(--text-muted); margin-bottom:5px; overflow:hidden; }
      .adm-meta-row span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .adm-card-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 18px 14px; }
      .adm-id-chip { font-size:.68rem; font-weight:700; color:var(--text-muted); background:var(--bg-panel); border:1px solid var(--border); border-radius:8px; padding:3px 9px; letter-spacing:.06em; }
      .adm-actions { display:flex; gap:6px; }
      .adm-btn { width:30px; height:30px; border-radius:8px; border:1px solid var(--border); background:var(--bg-panel); color:var(--text-sub); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.82rem; transition:all .18s; }
      .adm-btn:hover { background:rgba(59,130,246,.15); border-color:rgba(59,130,246,.4); color:var(--accent); transform:scale(1.12); }
      .adm-btn.del:hover { background:rgba(239,68,68,.15); border-color:rgba(239,68,68,.4); color:#f87171; }
      @media(max-width:540px){ .adm-grid{ grid-template-columns:1fr; } }
    </style>
    <div class="adm-grid">
    ${sorted.map((u,i)=>{
      const rm   = ROLE_META[u.ADM_role]||{label:u.ADM_role,color:"#888"};
      const rv   = roleVisual[u.ADM_role]||roleVisual.viewer;
      const init = (u.ADM_name||u.ADM_Uname||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
      const isMe = u.id===current?.id;
      const delay= i*0.06;
      return `<div class="adm-card" style="animation:fadeSlideUp .4s ${delay}s cubic-bezier(.22,1,.36,1) both;--adm-glow:${rv.glow};--adm-ring:${rv.ring}">
        <div class="adm-card-top">
          <div class="adm-card-bg" style="background:linear-gradient(${rv.gradient})"></div>
          <div class="adm-card-shine"></div>
          <div class="adm-avatar-wrap">
            <div class="adm-avatar" style="background:linear-gradient(${rv.gradient})">${init}<div class="adm-avatar-ring"></div></div>
            ${isMe?'<div class="adm-you">You</div>':''}
          </div>
          <div class="adm-role-pill">
            <div class="adm-role-dot" style="background:${rv.ring}"></div>
            ${rv.icon} ${rv.label}
          </div>
        </div>
        <div class="adm-card-body">
          <div class="adm-name">${u.ADM_name||u.ADM_Uname}</div>
          <div class="adm-username" style="color:${rv.ring}">@${u.ADM_Uname} · ${rv.desc}</div>
          <div class="adm-divider"></div>
          <div class="adm-meta-row"><span>✉️</span><span>${u.ADM_Email}</span></div>
        </div>
        <div class="adm-card-footer">
          <span class="adm-id-chip">${u.ADM_ID}</span>
          <div class="adm-actions">
            <button class="adm-btn" onclick="openEditAdmin('${u.id}')" title="Edit">✏️</button>
            ${!isMe?`<button class="adm-btn del" onclick="confirmDeleteAdmin('${u.id}')" title="Remove">🗑️</button>`:""}
          </div>
        </div>
      </div>`;
    }).join("")}
    </div>`;
}
window.renderAdmins = renderAdmins;

// ── STUDENT LIST ──────────────────────────────────────────────
function getDutyActivitiesList(student) {
  if (!student) return [];
  if (Array.isArray(student.dutyActivities)) return student.dutyActivities;
  if (typeof student.dutyActivities==="string"&&student.dutyActivities.trim()) return [{text:student.dutyActivities,createdAt:student.dutyUpdatedAt||""}];
  return [];
}

function getAchievementsList(student) {
  if (!student) return [];
  if (Array.isArray(student.achievements)) return student.achievements;
  if (typeof student.achievements==="string"&&student.achievements.trim()) return [{text:student.achievements,createdAt:""}];
  return [];
}

function getLatestText(list) { return list.length ? list[list.length-1].text : ""; }

function getDutyPercentageGraph(value, inline=false) {
  if (value==null||isNaN(Number(value))) return `<span class="duty-graph-empty">—</span>`;
  const pct = Math.max(0,Math.min(100,Number(value)));
  return `<div class="duty-graph${inline?" duty-graph-inline":""}" title="${pct}% duty completion">
    <div class="duty-graph-track"><div class="duty-graph-fill" style="width:${pct}%"></div></div>
    <span class="duty-graph-label">${pct}%</span>
  </div>`;
}

function getDutyActivitiesHtml(student, isAdmin=false) {
  const list = getDutyActivitiesList(student);
  if (!list.length) return `<div class="popup-field popup-field-full"><span class="popup-label">Duty Activities</span><span class="popup-value">—</span></div>`;
  return `<div class="popup-field popup-field-full"><span class="popup-label">Duty Activities</span>
    <div class="popup-value popup-value-list">${list.map((e,i)=>`
      <label class="history-item">
        ${isAdmin?`<input type="checkbox" class="history-checkbox" data-entry-type="duty" data-entry-index="${i}">`:""}
        <span class="history-text"><strong>${i+1}.</strong> ${e.text}</span>
      </label>`).join("")}</div></div>`;
}

function getAchievementsHtml(student, isAdmin=false) {
  const list = getAchievementsList(student);
  if (!list.length) return `<div class="popup-field popup-field-full"><span class="popup-label">Achievements</span><span class="popup-value">—</span></div>`;
  return `<div class="popup-field popup-field-full"><span class="popup-label">Achievements</span>
    <div class="popup-value popup-value-list">${list.map((e,i)=>`
      <label class="history-item">
        ${isAdmin?`<input type="checkbox" class="history-checkbox" data-entry-type="achievement" data-entry-index="${i}">`:""}
        <span class="history-text"><strong>${i+1}.</strong> ${e.text}</span>
      </label>`).join("")}</div></div>`;
}

function getFilteredSortedStudents() {
  const sv = searchQuery.toString().trim().toLowerCase();
  const pf = parseSearchFilter(sv);
  let filtered = students;
  if (pf?.type==="grade")      filtered = filtered.filter(s=>(s.grade??"").toString().trim().toLowerCase()===pf.value);
  else if (pf?.type==="department") filtered = filtered.filter(s=>(s.department??"").toString().trim().toLowerCase()===pf.value);
  else if (sv) filtered = filtered.filter(s=>[s.fullname,s.studentId,s.grade,s.role,s.department,s.status,s.email].filter(Boolean).some(v=>v.toString().toLowerCase().includes(sv)));
  return [...filtered].sort((a,b)=>{
    const av=(a[sortOption]??"").toString().toLowerCase();
    const bv=(b[sortOption]??"").toString().toLowerCase();
    return av.localeCompare(bv,undefined,{numeric:true});
  });
}

function renderStudents() {
  const list = document.getElementById("list");
  if (!list) return;
  const sorted = getFilteredSortedStudents();
  const sv     = searchQuery.toString().trim().toLowerCase();
  if (!sorted.length) {
    list.innerHTML = `<div class="empty-state">${sv?"No students match your search.":"No students found yet."}</div>`;
    return;
  }
  if (viewMode==="table") {
    let html = `<div class="student-table"><div class="table-row header"><div>Name</div><div>ID</div><div>Grade</div><div>Class</div><div>Role</div><div>Status</div><div>Duty%</div><div>Points</div><div>Activity</div></div>`;
    sorted.forEach((s,i) => {
      html += `<div class="table-row clickable-row" data-idx="${i}" style="animation-delay:${i*.04}s">
        <div>${s.fullname}</div><div>${s.studentId}</div><div>${s.grade}</div><div>${s.studentClass||"—"}</div>
        <div>${s.role}</div><div>${s.status} ${getDutyPercentageGraph(s.dutyPercentage,true)}</div>
        <div>${s.dutyPercentage!=null?s.dutyPercentage+"%":"—"}</div>
        <div style="color:var(--accent);font-weight:600">${s.dutyPoints??0}</div>
        <div>${getLatestText(getDutyActivitiesList(s))||"—"}</div>
      </div>`;
    });
    html += `</div>`;
    list.innerHTML = html;
    list.querySelectorAll(".clickable-row").forEach(row => {
      row.addEventListener("click",()=>openStudentPopup(sorted[parseInt(row.getAttribute("data-idx"))]));
    });
    return;
  }
  let html = `<div class="student-grid">`;
  sorted.forEach((s,i) => {
    const initials    = (s.fullname||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
    const statusClass = s.status?.toLowerCase()==="active"?"status-active":"status-inactive";
    html += `<div class="card clickable-card" data-idx="${i}" style="animation-delay:${i*.05}s">
      <div class="card-top">
        <div class="card-avatar">${s.profileImageUrl?`<img src="${s.profileImageUrl}" alt="${s.fullname||''}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.parentNode.textContent='${initials}'">`:`${initials}`}</div>
        <div class="card-header-info">
          <h2>${s.fullname}</h2>
          <div class="card-status-row">
            <span class="status-badge ${statusClass}">${s.status||"—"}</span>
            ${getDutyPercentageGraph(s.dutyPercentage,true)}
          </div>
        </div>
      </div>
      <div class="card-body">
        <p><strong>ID</strong><span>${s.studentId}</span></p>
        <p><strong>Grade</strong><span>${s.grade}</span></p>
        <p><strong>Role</strong><span>${s.role}</span></p>
        <p><strong>Dept</strong><span>${s.department}</span></p>
        <p><strong>Points</strong><span style="color:var(--accent);font-weight:700">${s.dutyPoints??0}</span></p>
        <p><strong>Duty %</strong><span>${s.dutyPercentage!=null?s.dutyPercentage+"%":"—"}</span></p>
        <p><strong>Email</strong><span>${s.email}</span></p>
        <p><strong>Phone</strong><span>${s.phone||"—"}</span></p>
      </div>
      <div class="card-footer-hint">Tap to view details →</div>
    </div>`;
  });
  html += `</div>`;
  list.innerHTML = html;
  list.querySelectorAll(".clickable-card").forEach(card => {
    card.addEventListener("click",()=>openStudentPopup(sorted[parseInt(card.getAttribute("data-idx"))]));
  });
}

function downloadStudentSheet(studentsToExport) {
  const headers = ["Name","Nickname","ID","Grade","Role","Department","Status","Age Category","Duty %","Points","Duty Activities","Achievements","Email","Phone","WhatsApp","Address","Birthday","Joined Year","Profile Image URL"];
  const rows = studentsToExport.map(s => [
    s.fullname,s.nickname||"",s.studentId,s.grade,s.role,s.department,s.status,s.experienceLevel,
    s.dutyPercentage!=null?`${s.dutyPercentage}%`:"",s.dutyPoints??0,
    getDutyActivitiesList(s).map((e,i)=>`${i+1}. ${e.text}`).join(" \n"),
    getAchievementsList(s).map((e,i)=>`${i+1}. ${e.text}`).join(" \n"),
    s.email,s.phone,s.whatsapp||"",s.address,s.birthday,s.joinedYear,s.profileImageUrl||""
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws["!cols"] = [{wch:20},{wch:15},{wch:10},{wch:8},{wch:18},{wch:12},{wch:8},{wch:12},{wch:8},{wch:8},{wch:30},{wch:30},{wch:25},{wch:15},{wch:15},{wch:20},{wch:12},{wch:12},{wch:25}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"RCMU Students");
  const blob = new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href=url; link.download="RCMU_student_sheet.xlsx";
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
}

// ── SAVE/UPDATE STUDENT ───────────────────────────────────────
function collectRoleValue() {
  const count  = Number(document.getElementById("roleCount")?.value||0);
  const values = [];
  for (let i=1;i<=count;i++) {
    const f = document.getElementById(`roleField${i}`);
    if (!f?.value.trim()) continue;
    let rv = f.value.trim();
    if (["Sinhala Announcer","Eng.Ann","English Announce","English Announcer"].includes(rv)) {
      const sub = document.getElementById(`roleSub${i}`);
      if (sub) {
        const subs = Array.from(sub.selectedOptions).map(o=>o.value.trim()).filter(Boolean);
        if (subs.length) rv = `${rv} - ${subs.join(" - ")}`;
      }
    }
    values.push(rv);
  }
  return values.join(" / ");
}

window.saveStudent = async function() {
  const user = requireAuth(["admin","editor"]);
  if (!user) return;
  const fields = ["fullname","nickname","studentId","grade","studentClass","department","status","experienceLevel","dutyPercentage","dutyActivities","achievements","profileImageUrl","email","phone","whatsapp","address","birthday","joinedYear"];
  const data = {};
  for (const f of fields) {
    if (f==="dutyActivities"||f==="achievements") {
      const raw = document.getElementById(f)?.value.trim()||"";
      data[f] = raw ? [{text:raw,createdAt:new Date().toISOString()}] : [];
    } else { data[f] = document.getElementById(f)?.value.trim()||""; }
  }
  data.role = collectRoleValue();
  if (data.dutyPercentage) data.dutyPercentage = Number(data.dutyPercentage);
  data.dutyPoints = 0;
  if (!data.fullname||!data.studentId||!data.grade) { showMessage("msg","⚠️ Name, ID and Grade are required.","#fb7185"); return; }
  const btn = document.querySelector(".form button");
  if (btn) { btn.disabled=true; btn.textContent="Saving…"; }
  try {
    const ref = await addDoc(collection(db,"RCMU_DB"),{...data,createdAt:new Date().toISOString()});
    await writeAuditLog("ADD_STUDENT",ref.id,data.fullname,"New student record created");
    showMessage("msg","✅ Student saved successfully.","#86efac");
    document.querySelectorAll(".form input,.form select,.form textarea").forEach(i=>i.value="");
  } catch(e) { showMessage("msg","❌ Error saving student.","#fb7185"); console.error(e); }
  finally { if(btn){btn.disabled=false;btn.textContent="Save Student";} }
};

window.updateStudent = async function() {
  const user = requireAuth(["admin","editor"]);
  if (!user) return;
  const student = window.editingStudent;
  if (!student||!student._docId) { showMessage("msg","❌ No student data to update.","#fb7185"); return; }
  const fields = ["fullname","nickname","studentId","grade","studentClass","department","status","experienceLevel","dutyPercentage","profileImageUrl","email","phone","whatsapp","address","birthday","joinedYear"];
  const data = {};
  for (const f of fields) data[f] = document.getElementById(f)?.value.trim()||"";
  data.role = collectRoleValue();
  if (data.dutyPercentage) data.dutyPercentage = Number(data.dutyPercentage);
  data.dutyActivities = student.dutyActivities||[];
  data.achievements   = student.achievements||[];
  if (!data.fullname||!data.studentId||!data.grade) { showMessage("msg","⚠️ Name, ID and Grade are required.","#fb7185"); return; }
  const btn = document.querySelector(".form button");
  if (btn) { btn.disabled=true; btn.textContent="Updating…"; }
  try {
    await updateDoc(doc(db,"RCMU_DB",student._docId),data);
    await writeAuditLog("EDIT_STUDENT",student._docId,data.fullname,"Student record updated");
    showMessage("msg","✅ Student updated.","#86efac");
    setTimeout(()=>window.location.href="index.html",1400);
  } catch(e) { showMessage("msg","❌ Error updating student.","#fb7185"); console.error(e); }
  finally { if(btn){btn.disabled=false;btn.textContent="Update Student";} }
};

// ── PAGE INITS ────────────────────────────────────────────────
async function initAdminPage() {
  if (!document.getElementById("adminListWrap")) return;
  requireAuth(["admin","editor"]);
  buildNavbar();
  renderAdmins(getAdminUsers());
  updateAdminStats();
}

async function initStudentFormPage() {
  requireAuth(["admin","editor"]);
  buildNavbar();
}

async function initStudentEditPage() {
  requireAuth(["admin","editor"]);
  buildNavbar();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) { showMessage("msg","❌ No student ID.","#fb7185"); return; }
  try {
    const snap = await getDoc(doc(db,"RCMU_DB",id));
    if (!snap.exists()) { showMessage("msg","❌ Student not found.","#fb7185"); return; }
    window.editingStudent = { _docId:snap.id, ...snap.data() };
    populateEditForm(window.editingStudent);
  } catch(e) { showMessage("msg","❌ Error loading data.","#fb7185"); console.error(e); }
}

function populateEditForm(student) {
  ["fullname","nickname","studentId","grade","studentClass","email","department","status","experienceLevel","profileImageUrl","phone","whatsapp","address","birthday","joinedYear"].forEach(f=>{
    const el=document.getElementById(f); if(el)el.value=student[f]||"";
  });
  const dp=document.getElementById("dutyPercentage"); if(dp)dp.value=student.dutyPercentage??0;
  const roles=(student.role||"").split(" / ").filter(r=>r.trim());
  const count=Math.min(roles.length,3);
  const rc=document.getElementById("roleCount"); if(rc)rc.value=count>0?count:"";
  for(let i=0;i<count;i++){
    const rf=document.getElementById(`roleField${i+1}`);
    if(rf){rf.value=roles[i].split(" - ")[0];rf.style.display="block";}
    const sub=roles[i].split(" - ")[1];
    if(sub){const sf=document.getElementById(`roleSub${i+1}`);if(sf){sf.value=sub;sf.style.display="block";}}
  }
  document.getElementById("roleCount")?.dispatchEvent(new Event("change"));
}

async function initStudentListPage() {
  if (!document.getElementById("list")) return;
  requireAuth(["admin","editor","viewer"]);
  buildNavbar();

  const cardsBtn    = document.getElementById("cardsViewBtn");
  const tableBtn    = document.getElementById("tableViewBtn");
  const addStudentBtn = document.getElementById("addStudentBtn");
  const downloadBtn = document.getElementById("downloadSheetBtn");
  const searchInput = document.getElementById("searchInput");
  const searchSugg  = document.getElementById("searchSuggestions");
  const sortSelect  = document.getElementById("sortSelect");

  cardsBtn?.addEventListener("click",()=>{viewMode="cards";cardsBtn.classList.add("active");tableBtn?.classList.remove("active");renderStudents();});
  tableBtn?.addEventListener("click",()=>{viewMode="table";tableBtn.classList.add("active");cardsBtn?.classList.remove("active");renderStudents();});
  addStudentBtn?.addEventListener("click",()=>{ window.location.href = 'add.html'; });
  downloadBtn?.addEventListener("click",()=>{ const vis=getFilteredSortedStudents(); if(!vis.length){alert("No data.");return;} downloadStudentSheet(vis); });
  searchInput?.addEventListener("input",e=>{searchQuery=e.target.value;renderStudents();});
  searchInput?.addEventListener("focus",()=>searchSugg?.classList.add("active"));
  sortSelect?.addEventListener("change",e=>{sortOption=e.target.value;renderStudents();});
  searchSugg?.addEventListener("click",e=>{
    const btn=e.target.closest("button[data-suggestion]"); if(!btn)return;
    const sug=btn.getAttribute("data-suggestion")||"";
    searchQuery=sug; if(searchInput){searchInput.value=sug;searchInput.focus();}
    searchSugg.classList.remove("active"); renderStudents();
  });
  document.addEventListener("click",e=>{ if(!searchSugg||!searchInput)return; if(e.target===searchInput||searchSugg.contains(e.target))return; searchSugg.classList.remove("active"); });

  onSnapshot(collection(db,"RCMU_DB"),snap=>{
    students=[];
    snap.forEach(d=>students.push({_docId:d.id,...d.data()}));
    renderStudents();
  });
}

// ── ATTENDANCE REPORT ─────────────────────────────────────────
async function initAttendanceReportPage() {
  requireAuth(["admin","editor","viewer"]);
  buildNavbar();
  let allStudents=[], allLogs=[];
  document.getElementById("reportLoading").style.display="flex";
  document.getElementById("reportContent").style.display="none";
  try {
    const [ss,ls] = await Promise.all([getDocs(collection(db,"RCMU_DB")),getDocs(collection(db,"RCMU_DutyLogs"))]);
    allStudents = ss.docs.map(d=>({_docId:d.id,...d.data()}));
    allLogs     = ls.docs.map(d=>({_id:d.id,...d.data()}));
  } catch(e){console.error(e);}
  document.getElementById("reportLoading").style.display="none";
  document.getElementById("reportContent").style.display="block";

  function renderReport() {
    const dept  = document.getElementById("rptDept")?.value||"all";
    const grade = document.getElementById("rptGrade")?.value||"all";
    const month = document.getElementById("rptMonth")?.value||"all";
    let filtered = allStudents;
    if(dept!=="all")  filtered=filtered.filter(s=>s.department===dept);
    if(grade!=="all") filtered=filtered.filter(s=>(s.grade||"").toString()===grade);
    const gs=document.getElementById("rptGrade");
    if(gs&&gs.options.length<=1){const grades=[...new Set(allStudents.map(s=>(s.grade||"").toString()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));grades.forEach(g=>{const o=document.createElement("option");o.value=g;o.textContent=`Grade ${g}`;gs.appendChild(o);});}
    const rows=filtered.map(s=>{
      let logs=allLogs.filter(l=>l.studentDocId===s._docId);
      if(month!=="all") logs=logs.filter(l=>l.date&&l.date.startsWith(month));
      const present=logs.filter(l=>l.type==="present").length;
      const late=logs.filter(l=>l.type==="late").length;
      const absent=logs.filter(l=>l.type==="absent").length;
      const total=present+late+absent;
      const pct=total>0?Math.round(((present+late)/total)*100):(s.dutyPercentage??null);
      return {s,present,late,absent,total,pct,pts:Number(s.dutyPoints)||0};
    });
    const avgPct=rows.length?Math.round(rows.reduce((a,r)=>a+(r.pct??0),0)/rows.length):0;
    const topDeptMap={}; rows.forEach(r=>{const d=r.s.department||"—";topDeptMap[d]=(topDeptMap[d]||0)+(r.pct||0);});
    const topDept=Object.entries(topDeptMap).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—";
    document.getElementById("rptStatStudents").textContent=rows.length;
    document.getElementById("rptStatAvgPct").textContent=avgPct+"%";
    document.getElementById("rptStatTopDept").textContent=topDept;
    document.getElementById("rptStatPerfect").textContent=rows.filter(r=>r.pct===100).length;
    const tbody=document.getElementById("rptTableBody"),empty=document.getElementById("rptEmpty");
    if(!rows.length){tbody.innerHTML="";empty.style.display="block";return;}
    empty.style.display="none";
    rows.sort((a,b)=>(b.pct??0)-(a.pct??0));
    tbody.innerHTML=rows.map((r,i)=>{
      const pct=r.pct??"—",pctN=Number(pct)||0;
      const pc=pctN>=80?"var(--green)":pctN>=50?"var(--gold)":"var(--red)";
      const sc=r.s.status==="active"?"status-active":"status-inactive";
      const init=(r.s.fullname||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
      return `<tr style="animation:rowIn .25s ${i*.03}s both">
        <td><div class="rpt-name-cell"><div class="rpt-avatar">${init}</div><div><div class="rpt-name">${r.s.fullname||"—"}</div><div class="rpt-sub">${r.s.studentId||"—"}</div></div></div></td>
        <td style="color:var(--text-sub);font-size:.78rem">${r.s.grade||"—"}</td>
        <td style="color:var(--text-sub);font-size:.78rem">${r.s.department||"—"}</td>
        <td><span class="status-badge ${sc}">${r.s.status||"—"}</span></td>
        <td style="color:var(--green);font-weight:600">${r.present}</td>
        <td style="color:var(--gold);font-weight:600">${r.late}</td>
        <td style="color:var(--red);font-weight:600">${r.absent}</td>
        <td style="color:var(--accent2)">${r.total}</td>
        <td><div class="rpt-pct-wrap"><div class="rpt-pct-bar"><div class="rpt-pct-fill" style="width:${pctN}%;background:${pc}"></div></div><span style="color:${pc};font-weight:600;font-size:.82rem;min-width:36px">${pct}${typeof pct==="number"?"%":""}</span></div></td>
        <td style="color:var(--accent);font-weight:600">${r.pts}</td>
      </tr>`;
    }).join("");
  }
  window._renderReport=renderReport;
  ["rptDept","rptGrade","rptMonth"].forEach(id=>document.getElementById(id)?.addEventListener("change",renderReport));
  renderReport();
}

// ── ACTIVITY LOG ──────────────────────────────────────────────
async function initActivityLogPage() {
  requireAuth(["admin"]);
  buildNavbar();
  let allLogs = [];

  const el = id => document.getElementById(id);

  el("logLoading").style.display = "flex";
  el("logTableWrap").style.display = "none";

  try {
    const snap = await getDocs(collection(db, "RCMU_AuditLog"));
    allLogs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch(e) { console.error(e); }

  el("logLoading").style.display = "none";
  el("logTableWrap").style.display = "block";

  // Summary stats
  function updateStats(logs) {
    el("statTotal").textContent   = logs.length;
    el("statAdds").textContent    = logs.filter(l => l.action === "ADD_STUDENT").length;
    el("statEdits").textContent   = logs.filter(l => l.action === "EDIT_STUDENT").length;
    el("statDeletes").textContent = logs.filter(l => l.action === "DELETE_STUDENT").length;
    el("statDuty").textContent    = logs.filter(l => l.action === "DUTY_MARK").length;
  }
  updateStats(allLogs);

  const ACTION_META = {
    ADD_STUDENT:    { label: "Added Student",   color: "var(--green)",   icon: "➕" },
    EDIT_STUDENT:   { label: "Edited Student",  color: "var(--accent)",  icon: "✏️" },
    DELETE_STUDENT: { label: "Deleted Student", color: "var(--red)",     icon: "🗑" },
    POINTS_ADD:     { label: "Points Added",    color: "var(--green)",   icon: "⬆" },
    POINTS_REMOVE:  { label: "Points Removed",  color: "var(--gold)",    icon: "⬇" },
    DUTY_MARK:      { label: "Marked Duty",     color: "var(--accent2)", icon: "🗂" },
  };

  const ROLE_COLOR = { admin: "#f59e0b", editor: "#3b82f6", viewer: "#10b981" };

  function applyFilters(logs) {
    const tf = el("logTypeFilter")?.value || "all";
    const rf = el("logRoleFilter")?.value || "all";
    const df = el("logDateFilter")?.value || "all";
    const sf = (el("logSearch")?.value || "").toLowerCase().trim();

    const now = Date.now();
    const DAY = 86400000;

    let f = logs;
    if (tf !== "all") f = f.filter(l => l.action === tf);
    if (rf !== "all") f = f.filter(l => l.performedByRole === rf);
    if (df === "today") f = f.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString());
    if (df === "week")  f = f.filter(l => now - new Date(l.timestamp).getTime() <= 7  * DAY);
    if (df === "month") f = f.filter(l => now - new Date(l.timestamp).getTime() <= 30 * DAY);
    if (sf) f = f.filter(l =>
      (l.targetName || "").toLowerCase().includes(sf) ||
      (l.targetId   || "").toLowerCase().includes(sf) ||
      (l.performedBy || "").toLowerCase().includes(sf) ||
      (l.performedByName || "").toLowerCase().includes(sf) ||
      (l.details || "").toLowerCase().includes(sf)
    );
    return f;
  }

  function renderLog(logs) {
    const f = applyFilters(logs);
    el("logCount").textContent = `${f.length} entr${f.length === 1 ? "y" : "ies"}`;
    const tbody = el("logBody"), empty = el("logEmpty");

    if (!f.length) { tbody.innerHTML = ""; empty.style.display = "block"; return; }
    empty.style.display = "none";

    tbody.innerHTML = f.map((l, i) => {
      const m  = ACTION_META[l.action] || { label: l.action || "Unknown", color: "var(--text-muted)", icon: "•" };
      const dt = new Date(l.timestamp);
      const dateStr = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const rc  = ROLE_COLOR[l.performedByRole] || "#888";
      const shortId = (l.targetId || "").slice(-6) || "—";

      return `<tr style="animation:rowIn .18s ${Math.min(i,.25)*0.08}s both">
        <td style="white-space:nowrap">
          <div style="font-size:.78rem;color:var(--text-sub);font-weight:500">${dateStr}</div>
          <div style="font-size:.68rem;color:var(--text-muted)">${timeStr}</div>
        </td>
        <td>
          <span class="log-action-badge" style="background:${m.color}18;color:${m.color};border-color:${m.color}35">
            ${m.icon} ${m.label}
          </span>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:7px">
            <div style="width:26px;height:26px;border-radius:50%;background:${rc}20;color:${rc};border:1.5px solid ${rc}40;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;flex-shrink:0">
              ${(l.performedByName || l.performedBy || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-size:.82rem;font-weight:600;color:var(--text)">${l.performedByName || l.performedBy || "—"}</div>
              <div style="font-size:.65rem;color:${rc};text-transform:uppercase;letter-spacing:.05em">${l.performedByRole || "—"}</div>
            </div>
          </div>
        </td>
        <td>
          <div style="font-size:.82rem;color:var(--text-sub);font-weight:500">${l.targetName || "—"}</div>
          ${l.targetId ? `<div style="font-size:.65rem;color:var(--text-muted);font-family:monospace">${l.targetId}</div>` : ""}
        </td>
        <td style="font-size:.75rem;color:var(--text-muted);max-width:240px;word-break:break-word">${l.details || "—"}</td>
        <td style="text-align:center">
          <code style="font-size:.62rem;color:var(--text-muted);background:var(--bg-panel);padding:2px 6px;border-radius:5px;border:1px solid var(--border)">${shortId}</code>
        </td>
      </tr>`;
    }).join("");
  }

  renderLog(allLogs);

  // Wire all filters
  ["logTypeFilter","logRoleFilter","logDateFilter","logSearch"].forEach(id =>
    el(id)?.addEventListener(id === "logSearch" ? "input" : "change", () => renderLog(allLogs))
  );

  // Refresh
  el("logRefresh")?.addEventListener("click", async () => {
    el("logLoading").style.display = "flex";
    el("logTableWrap").style.display = "none";
    try {
      const snap = await getDocs(collection(db, "RCMU_AuditLog"));
      allLogs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      allLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      updateStats(allLogs);
    } catch(e) { console.error(e); }
    el("logLoading").style.display = "none";
    el("logTableWrap").style.display = "block";
    renderLog(allLogs);
    showToast("🔄 Audit log refreshed.");
  });

  // CSV export
  el("exportCsvBtn")?.addEventListener("click", () => {
    const rows = applyFilters(allLogs);
    if (!rows.length) { showToast("No entries to export.", "error"); return; }
    const headers = ["Date","Time","Action","Performed By","Role","Target Student","Target ID","Details"];
    const lines = rows.map(l => {
      const dt = new Date(l.timestamp);
      return [
        dt.toLocaleDateString("en-GB"),
        dt.toLocaleTimeString("en-GB"),
        l.action || "",
        l.performedByName || l.performedBy || "",
        l.performedByRole || "",
        l.targetName || "",
        l.targetId || "",
        (l.details || "").replace(/,/g, ";")
      ].map(v => `"${v}"`).join(",");
    });
    const csv  = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `RCMU_AuditLog_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast("✅ CSV exported successfully.");
  });
}

// ── ROUTER ────────────────────────────────────────────────────
const PAGE = window.location.pathname.split("/").pop().split("?")[0]||"index.html";
if      (PAGE==="admin.html")             initAdminPage();
else if (PAGE==="add.html")               initStudentFormPage();
else if (PAGE==="edit.html")              initStudentEditPage();
else if (PAGE==="index.html")             initStudentListPage();
else if (PAGE==="attendance-report.html") initAttendanceReportPage();
else if (PAGE==="activity-log.html")      initActivityLogPage();
else if (PAGE==="duty-schedule.html"||PAGE==="duty-mark.html"||PAGE==="duty-appeals.html") buildNavbar();
else if (PAGE==="duty-swap.html"||PAGE==="Activity-log.html"||PAGE==="activity-log.html") buildNavbar();
else if (PAGE==="leaderboard.html"||PAGE==="announcements.html"||PAGE==="dept-analytics.html") buildNavbar();
else if (PAGE==="report-card.html"||PAGE==="monthly-summary.html") buildNavbar();

// ── PWA INSTALL BANNER ────────────────────────────────────────
(function() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Inject banner styles
  const style = document.createElement('style');
  style.textContent = `
/* ── Install banner ── */
    #rcmu-install-banner {
      position: fixed; top: 18px; right: 18px;
      z-index: 9999; width: min(92vw, 360px);
      background: linear-gradient(135deg, #111827 0%, #0f172a 100%);
      border: 1px solid rgba(245,158,11,0.25);
      border-radius: 20px;
      padding: 0;
      box-shadow: 0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.08),
                  inset 0 1px 0 rgba(255,255,255,0.06);
      transition: transform 0.55s cubic-bezier(.22,1,.36,1), opacity 0.55s cubic-bezier(.22,1,.36,1);
      transform: translateX(120%);
      opacity: 0;
      overflow: hidden;
    }
    #rcmu-install-banner.show {
      transform: translateX(0);
      opacity: 1;
    }
    #rcmu-install-banner::before {
      content: '';
      position: absolute; top: 0; left: 15%; right: 15%; height: 2px;
      background: linear-gradient(90deg, transparent, #f59e0b, #3b82f6, transparent);
      border-radius: 2px;
      animation: bannerLine 3s ease-in-out infinite;
    }
    @keyframes bannerLine {
      0%,100% { left: 15%; right: 15%; opacity: .7; }
      50%      { left: 5%; right: 5%; opacity: 1; }
    }
    .rib-bg {
      position: absolute; inset: 0; border-radius: 20px; overflow: hidden; pointer-events: none;
    }
    .rib-bg::before {
      content: ''; position: absolute; width: 280px; height: 280px;
      background: radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%);
      top: -80px; right: -60px; border-radius: 50%;
    }
    .rib-bg::after {
      content: ''; position: absolute; width: 200px; height: 200px;
      background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);
      bottom: -60px; left: -40px; border-radius: 50%;
    }
    .rib-inner {
      position: relative; z-index: 1;
      display: flex; align-items: center; gap: 16px;
      padding: 18px 20px 16px;
    }
    .rib-icon-wrap {
      position: relative; flex-shrink: 0;
    }
    .rib-icon {
      width: 58px; height: 58px; border-radius: 14px;
      background: linear-gradient(135deg, #1c1f2e, #111827);
      border: 1px solid rgba(245,158,11,0.2);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(245,158,11,0.06);
    }
    .rib-icon img { width: 44px; height: 44px; object-fit: contain; }
    .rib-icon-ring {
      position: absolute; inset: -4px; border-radius: 18px;
      border: 2px solid rgba(245,158,11,0.3);
      animation: ribRing 2.5s ease-in-out infinite;
    }
    @keyframes ribRing {
      0%,100% { opacity: .4; transform: scale(1); }
      50%      { opacity: .9; transform: scale(1.05); }
    }
    .rib-badge {
      position: absolute; top: -5px; right: -5px;
      background: #f59e0b; color: #000; font-size: .52rem; font-weight: 800;
      letter-spacing: .06em; padding: 2px 6px; border-radius: 20px;
      text-transform: uppercase; animation: ribBadge 2s ease-in-out infinite;
    }
    @keyframes ribBadge { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }
    .rib-text { flex: 1; min-width: 0; }
    .rib-title {
      font-size: .92rem; font-weight: 700; color: #f1f5f9;
      letter-spacing: -.01em; margin-bottom: 3px;
      display: flex; align-items: center; gap: 7px;
    }
    .rib-new-chip {
      font-size: .58rem; font-weight: 700; letter-spacing: .08em;
      text-transform: uppercase; padding: 2px 7px; border-radius: 20px;
      background: rgba(59,130,246,0.18); color: #60a5fa;
      border: 1px solid rgba(59,130,246,0.25);
    }
    .rib-sub {
      font-size: .73rem; color: #64748b; line-height: 1.45;
    }
    .rib-features {
      display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px;
    }
    .rib-feat {
      font-size: .62rem; font-weight: 600; letter-spacing: .04em;
      padding: 2px 8px; border-radius: 20px;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      color: #94a3b8;
    }
    .rib-actions {
      display: flex; gap: 8px; align-items: center;
      padding: 0 20px 16px;
    }
    .rib-btn-install {
      flex: 1; padding: 11px 0; border-radius: 12px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: #fff; font-size: .83rem; font-weight: 700; letter-spacing: .04em;
      box-shadow: 0 4px 18px rgba(245,158,11,0.35);
      transition: all .2s cubic-bezier(.4,0,.2,1);
      position: relative; overflow: hidden;
    }
    .rib-btn-install::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.15) 0%, transparent 60%);
    }
    .rib-btn-install:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 28px rgba(245,158,11,0.5);
    }
    .rib-btn-install:active { transform: translateY(0); }
    .rib-btn-later {
      padding: 11px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1);
      background: rgba(255,255,255,.04); color: #64748b; font-size: .78rem;
      font-weight: 600; cursor: pointer;
      transition: all .2s;
    }
    .rib-btn-later:hover { background: rgba(255,255,255,.08); color: #94a3b8; }
    .rib-close {
      position: absolute; top: 12px; right: 14px;
      width: 24px; height: 24px; border-radius: 50%; border: none;
      background: rgba(255,255,255,.06); color: #64748b;
      cursor: pointer; font-size: .75rem; display: flex;
      align-items: center; justify-content: center;
      transition: all .2s;
    }
    .rib-close:hover { background: rgba(239,68,68,.15); color: #f87171; }

    /* ── Link click transition ── */
    a[href]:not([href^="#"]):not([href^="javascript"]):not([onclick]) {
      position: relative;
    }
  `;
  document.head.appendChild(style);



  // ── Install banner logic ──
  let deferredPrompt = null;
  const DISMISSED_KEY = 'rcmu_install_dismissed';
  const INSTALLED_KEY = 'rcmu_installed';

  // Don't show if already dismissed recently or installed
  function wasDismissedRecently() {
    const t = localStorage.getItem(DISMISSED_KEY);
    if (!t) return false;
    return (Date.now() - parseInt(t)) < 3 * 24 * 60 * 60 * 1000; // 3 days
  }

  function createBanner() {
    if (document.getElementById('rcmu-install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'rcmu-install-banner';
    banner.innerHTML = `
      <div class="rib-bg"></div>
      <button class="rib-close" id="ribClose" title="Dismiss">✕</button>
      <div class="rib-inner">
        <div class="rib-icon-wrap">
          <div class="rib-icon">
            <img src="Media_Unit_Original_logo.png" alt="RCMU">
          </div>
          <div class="rib-icon-ring"></div>
          <div class="rib-badge">NEW</div>
        </div>
        <div class="rib-text">
          <div class="rib-title">
            Install RCMU App
            <span class="rib-new-chip">First Visit</span>
          </div>
          <div class="rib-sub">Add to your home screen for instant access — no browser needed.</div>
          <div class="rib-features">
            <span class="rib-feat">⚡ Faster</span>
            <span class="rib-feat">📴 Offline</span>
            <span class="rib-feat">🔔 Alerts</span>
          </div>
        </div>
      </div>
      <div class="rib-actions">
        <button class="rib-btn-install" id="ribInstall">📲 Install App</button>
        <button class="rib-btn-later" id="ribLater">Maybe Later</button>
      </div>
    `;
    document.body.appendChild(banner);

    // Show with animation
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));

    document.getElementById('ribClose').onclick = () => hideBanner(true);
    document.getElementById('ribLater').onclick = () => hideBanner(true);
    document.getElementById('ribInstall').onclick = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          localStorage.setItem(INSTALLED_KEY, '1');
          hideBanner(false);
        } else {
          hideBanner(true);
        }
        deferredPrompt = null;
      } else {
        // iOS / fallback: show instructions toast
        hideBanner(true);
        showInstallToast();
      }
    };
  }

  function hideBanner(saveDismiss) {
    const b = document.getElementById('rcmu-install-banner');
    if (!b) return;
    b.classList.remove('show');
    if (saveDismiss) localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setTimeout(() => b.remove(), 600);
  }

  function showInstallToast() {
    // Already have showToast in app.js — use it if available
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const msg = isIOS
      ? '📲 Tap the Share button then "Add to Home Screen"'
      : '📲 Open browser menu → "Add to Home Screen" or "Install App"';
    if (typeof showToast === 'function') {
      showToast(msg, 5000);
    } else {
      alert(msg);
    }
  }

  // Capture the install prompt event
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (!localStorage.getItem(INSTALLED_KEY) && !wasDismissedRecently()) {
      setTimeout(createBanner, 1200); // slight delay after page load
    }
  });

  // App installed event
  window.addEventListener('appinstalled', () => {
    localStorage.setItem(INSTALLED_KEY, '1');
    hideBanner(false);
    if (typeof showToast === 'function') showToast('✅ RCMU App installed successfully!');
  });

  // iOS detection — show banner manually if no beforeinstallprompt (iOS Safari)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIOS && !isStandalone && !localStorage.getItem(INSTALLED_KEY) && !wasDismissedRecently()) {
    setTimeout(createBanner, 1500);
  }

})();