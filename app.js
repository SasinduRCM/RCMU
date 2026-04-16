import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let students = [];
let viewMode = "cards";
let searchQuery = "";
let sortOption = "fullname";

// ── AUTH HELPERS ──────────────────────────────────────────────────────────────

function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem("rcmu_admin");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function requireAuth(allowedRoles = []) {
  const user = getCurrentUser();
  if (!user) { window.location.href = "login.html"; return null; }
  if (allowedRoles.length && !allowedRoles.includes(user.ADM_role)) {
    if (user.ADM_role === "viewer") window.location.href = "index.html";
    else if (user.ADM_role === "editor") window.location.href = "add.html";
    else window.location.href = "admin.html";
    return null;
  }
  return user;
}

window.doLogout = function () {
  sessionStorage.removeItem("rcmu_admin");
  window.location.href = "login.html";
};

// ── UI HELPERS ────────────────────────────────────────────────────────────────

function showMessage(id, text, color = "#86efac") {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerText = text;
  element.style.color = color;
  element.style.opacity = "0";
  element.style.transform = "translateY(6px)";
  requestAnimationFrame(() => {
    element.style.transition = "opacity 0.3s, transform 0.3s";
    element.style.opacity = "1";
    element.style.transform = "translateY(0)";
  });
}

function updateHeaderUser() {
  const user = getCurrentUser();
  const userBadge = document.getElementById("currentUser");
  if (!userBadge) return;
  if (!user) { userBadge.textContent = ""; return; }
  const roleColors = { admin: "#f59e0b", editor: "#3b82f6", viewer: "#10b981" };
  const roleIcons  = { admin: "⚡", editor: "✏️", viewer: "👁" };
  const color = roleColors[user.ADM_role] || "#64748b";
  const icon  = roleIcons[user.ADM_role] || "";
  userBadge.innerHTML = `
    <span class="user-avatar">${user.ADM_name.charAt(0).toUpperCase()}</span>
    <span>${user.ADM_Uname}</span>
    <span class="role-tag" style="background:${color}22;color:${color};border-color:${color}44">${icon} ${user.ADM_role}</span>
  `;
}

function parseSearchFilter(value) {
  const n = value.toString().trim().toLowerCase();
  if (n.startsWith("grade "))      return { type: "grade",      value: n.slice(6).trim() };
  if (n.startsWith("department ")) return { type: "department", value: n.slice(11).trim() };
  return null;
}

function getAdminUsers() {
  return Array.isArray(window.manualAdmins) ? window.manualAdmins : [];
}

function saveAdminUsers() {
  if (typeof window.saveManualAdmins === "function") window.saveManualAdmins();
}

// ── STUDENT DETAIL POPUP ──────────────────────────────────────────────────────

function openStudentPopup(s) {
  const existing = document.getElementById("studentPopup");
  if (existing) existing.remove();

  const initials = (s.fullname || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const statusClass = s.status?.toLowerCase() === "active" ? "status-active" : "status-inactive";

  const overlay = document.createElement("div");
  overlay.id = "studentPopup";
  overlay.className = "popup-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  overlay.innerHTML = `
    <div class="popup-card" id="popupCard">
      <div class="popup-glow"></div>
      <button class="popup-close" id="popupCloseBtn" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M1 1l16 16M17 1L1 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="popup-header">
        <div class="popup-avatar">${initials}</div>
        <div class="popup-header-info">
          <h2 class="popup-name">${s.fullname}</h2>
          ${s.nickname ? `<p class="popup-nickname">"${s.nickname}"</p>` : ""}
          <span class="status-badge ${statusClass}">${s.status || "—"}</span>
        </div>
      </div>

      <div class="popup-divider"></div>

      <div class="popup-grid">
        <div class="popup-field">
          <span class="popup-label">Student ID</span>
          <span class="popup-value">${s.studentId || "—"}</span>
        </div>
        <div class="popup-field">
          <span class="popup-label">Grade</span>
          <span class="popup-value">${s.grade || "—"}</span>
        </div>
        <div class="popup-field">
          <span class="popup-label">Role</span>
          <span class="popup-value">${s.role || "—"}</span>
        </div>
        <div class="popup-field">
          <span class="popup-label">Department</span>
          <span class="popup-value">${s.department || "—"}</span>
        </div>
        <div class="popup-field">
          <span class="popup-label">Experience</span>
          <span class="popup-value">${s.experienceLevel || "—"}</span>
        </div>
        <div class="popup-field">
          <span class="popup-label">Birthday</span>
          <span class="popup-value">${s.birthday || "—"}</span>
        </div>
        <div class="popup-field">
          <span class="popup-label">Joined Year</span>
          <span class="popup-value">${s.joinedYear || "—"}</span>
        </div>
        <div class="popup-field popup-field-full">
          <span class="popup-label">Email</span>
          <span class="popup-value">${s.email || "—"}</span>
        </div>
        <div class="popup-field popup-field-full">
          <span class="popup-label">Phone</span>
          <span class="popup-value">${s.phone || "—"}</span>
        </div>
        <div class="popup-field popup-field-full">
          <span class="popup-label">Address</span>
          <span class="popup-value">${s.address || "—"}</span>
        </div>
        ${s.profileImageUrl ? `
        <div class="popup-field popup-field-full">
          <span class="popup-label">Profile Image</span>
          <img src="${s.profileImageUrl}" alt="Profile" class="popup-profile-img" onerror="this.style.display='none'">
        </div>` : ""}
      </div>

      ${getCurrentUser()?.ADM_role === "admin" ? `
      <div class="popup-actions">
        <button class="delete-confirm-btn" type="button" onclick="confirmDeleteStudent('${s._docId}', '${(s.fullname || "this student").replace(/'/g, "\\'")}')">Delete Student</button>
      </div>
      ` : ""}

      <button class="popup-close-bottom" id="popupCloseBtnBottom">Close</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add("popup-visible");
  });

  const close = () => {
    overlay.classList.remove("popup-visible");
    overlay.classList.add("popup-hiding");
    setTimeout(() => { overlay.remove(); document.body.style.overflow = ""; }, 320);
  };

  document.getElementById("popupCloseBtn").addEventListener("click", close);
  document.getElementById("popupCloseBtnBottom").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });
}

// ── ADMIN EDIT MODAL ──────────────────────────────────────────────────────────

window.openEditAdmin = function (adminId) {
  const admins = getAdminUsers();
  const admin  = admins.find(a => a.id === adminId);
  if (!admin) return;

  const existing = document.getElementById("editAdminModal");
  if (existing) existing.remove();

  const roleColors = { admin: "#f59e0b", editor: "#3b82f6", viewer: "#10b981" };
  const color = roleColors[admin.ADM_role] || "#64748b";

  const overlay = document.createElement("div");
  overlay.id = "editAdminModal";
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-card edit-admin-card" id="editAdminCard">
      <div class="popup-glow" style="background:radial-gradient(ellipse 60% 40% at 50% 0%, ${color}18 0%, transparent 70%)"></div>
      <button class="popup-close" id="editAdminClose" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M1 1l16 16M17 1L1 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="popup-header">
        <div class="popup-avatar" style="background:linear-gradient(135deg,${color},${color}99)">${admin.ADM_name.charAt(0).toUpperCase()}</div>
        <div class="popup-header-info">
          <h2 class="popup-name">Edit Administrator</h2>
          <p class="popup-nickname">@${admin.ADM_Uname}</p>
        </div>
      </div>

      <div class="popup-divider"></div>

      <div class="edit-admin-notice">
        <span>🔒</span> Username, email and password cannot be changed here.
      </div>

      <div class="edit-admin-form">
        <div class="edit-field">
          <label>Full Name</label>
          <input id="editAdmName" value="${admin.ADM_name}" placeholder="Full Name">
        </div>
        <div class="edit-field">
          <label>Admin ID</label>
          <input id="editAdmId" value="${admin.ADM_ID}" placeholder="Admin ID">
        </div>
        <div class="edit-field">
          <label>Role</label>
          <select id="editAdmRole">
            <option value="admin"  ${admin.ADM_role === "admin"  ? "selected" : ""}>⚡ Admin — full access</option>
            <option value="editor" ${admin.ADM_role === "editor" ? "selected" : ""}>✏️ Editor — add/edit students</option>
            <option value="viewer" ${admin.ADM_role === "viewer" ? "selected" : ""}>👁 Viewer — view only</option>
          </select>
        </div>
      </div>

      <div class="edit-admin-actions">
        <button class="edit-save-btn" onclick="saveEditAdmin('${adminId}')">Save Changes</button>
        <button class="edit-cancel-btn" id="editAdminCancel">Cancel</button>
        <button class="edit-delete-btn" type="button" onclick="confirmDeleteAdmin('${adminId}')">Delete</button>
      </div>
      <p id="editAdminMsg" style="text-align:center;font-size:0.82rem;min-height:20px;margin-top:10px;"></p>
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

  document.getElementById("editAdminClose").addEventListener("click", close);
  document.getElementById("editAdminCancel").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
};

window.saveEditAdmin = function (adminId) {
  const admins = getAdminUsers();
  const idx    = admins.findIndex(a => a.id === adminId);
  if (idx === -1) return;

  const name  = document.getElementById("editAdmName").value.trim();
  const admId = document.getElementById("editAdmId").value.trim();
  const role  = document.getElementById("editAdmRole").value;

  if (!name || !admId || !role) {
    const msg = document.getElementById("editAdminMsg");
    if (msg) { msg.textContent = "⚠️ All fields required."; msg.style.color = "#fb7185"; }
    return;
  }

  admins[idx] = { ...admins[idx], ADM_name: name, ADM_ID: admId, ADM_role: role };
  window.manualAdmins = admins;
  saveAdminUsers();

  const msg = document.getElementById("editAdminMsg");
  if (msg) { msg.textContent = "✅ Changes saved!"; msg.style.color = "#86efac"; }

  setTimeout(() => {
    const overlay = document.getElementById("editAdminModal");
    if (overlay) {
      overlay.classList.remove("popup-visible");
      overlay.classList.add("popup-hiding");
      setTimeout(() => { overlay.remove(); document.body.style.overflow = ""; }, 320);
    }
    renderAdmins(getAdminUsers());
    updateAdminStats();
  }, 800);
};

window.confirmDeleteAdmin = function (adminId) {
  const admins = getAdminUsers();
  const admin  = admins.find(a => a.id === adminId);
  if (!admin) return;

  // Prevent deleting yourself
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.ADM_Uname === admin.ADM_Uname) {
    showToast("⛔ You cannot delete your own account.", "error");
    return;
  }

  const existing = document.getElementById("deleteConfirmModal");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "deleteConfirmModal";
  overlay.className = "popup-overlay";

  overlay.innerHTML = `
    <div class="popup-card delete-confirm-card" id="deleteConfirmCard">
      <div class="delete-icon-wrap">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 11v6M14 11v6" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>
      <h3 class="delete-title">Remove Administrator?</h3>
      <p class="delete-desc">This will permanently remove <strong>${admin.ADM_name}</strong> (@${admin.ADM_Uname}) from the system. This action cannot be undone.</p>
      <div class="delete-actions">
        <button class="delete-confirm-btn" onclick="deleteAdmin('${adminId}')">Yes, Remove</button>
        <button class="delete-cancel-btn" id="deleteCancelBtn">Cancel</button>
      </div>
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

  document.getElementById("deleteCancelBtn").addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
};

window.deleteAdmin = function (adminId) {
  window.manualAdmins = getAdminUsers().filter(a => a.id !== adminId);
  saveAdminUsers();

  const overlay = document.getElementById("deleteConfirmModal");
  if (overlay) {
    overlay.classList.remove("popup-visible");
    overlay.classList.add("popup-hiding");
    setTimeout(() => { overlay.remove(); document.body.style.overflow = ""; }, 320);
  }

  renderAdmins(getAdminUsers());
  updateAdminStats();
  showToast("✅ Administrator removed.", "success");
};

// ── TOAST NOTIFICATIONS ───────────────────────────────────────────────────────

function showToast(message, type = "success") {
  const existing = document.querySelector(".rcmu-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `rcmu-toast rcmu-toast-${type}`;
  toast.innerHTML = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("rcmu-toast-visible"));
  setTimeout(() => {
    toast.classList.remove("rcmu-toast-visible");
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

window.confirmDeleteStudent = function (docId, studentName = "this student") {
  if (!docId) return;
  const confirmed = window.confirm(`Are you sure you want to permanently delete ${studentName}?`);
  if (!confirmed) return;
  window.deleteStudent(docId);
};

window.deleteStudent = async function (docId) {
  const user = getCurrentUser();
  if (!user || user.ADM_role !== "admin") {
    showToast("⛔ Only admins can delete students.", "error");
    return;
  }

  try {
    await deleteDoc(doc(db, "RCMU_DB", docId));
    const overlay = document.getElementById("studentPopup");
    if (overlay) {
      overlay.classList.remove("popup-visible");
      overlay.classList.add("popup-hiding");
      setTimeout(() => { overlay.remove(); document.body.style.overflow = ""; }, 320);
    }
    showToast("✅ Student removed from the database.", "success");
  } catch (error) {
    console.error(error);
    showToast("❌ Could not delete student. Try again.", "error");
  }
};

// ── ADMIN PAGE ────────────────────────────────────────────────────────────────

window.createUser = function () {
  const user = getCurrentUser();
  if (!user || user.ADM_role !== "admin") {
    showMessage("userMsg", "⛔ Only admins can create users.", "#fb7185");
    return;
  }

  const email    = document.getElementById("ADM_Email").value.trim();
  const admId    = document.getElementById("ADM_ID").value.trim();
  const uname    = document.getElementById("ADM_Uname").value.trim();
  const name     = document.getElementById("ADM_name").value.trim();
  const password = document.getElementById("ADM_password").value.trim();
  const role     = document.getElementById("ADM_role").value;

  if (!email || !admId || !uname || !name || !password || !role) {
    showMessage("userMsg", "⚠️ All fields are required.", "#fb7185");
    return;
  }

  const existing  = getAdminUsers().find(a => a.ADM_Email.toLowerCase() === email.toLowerCase());
  if (existing) { showMessage("userMsg", "⚠️ Email already in use.", "#fb7185"); return; }

  const unameCheck = getAdminUsers().find(a => a.ADM_Uname.toLowerCase() === uname.toLowerCase());
  if (unameCheck) { showMessage("userMsg", "⚠️ Username already taken.", "#fb7185"); return; }

  const btn = document.querySelector("#adminPanel .panel-card button");
  if (btn) { btn.disabled = true; btn.textContent = "Creating…"; }

  try {
    const newAdmin = {
      id: `manual-${Date.now()}`,
      ADM_Email: email, ADM_ID: admId, ADM_Uname: uname,
      ADM_name: name, ADM_password: password, ADM_role: role
    };
    window.manualAdmins = getAdminUsers().concat(newAdmin);
    saveAdminUsers();
    showMessage("userMsg", "✅ Admin user created successfully.", "#86efac");
    ["ADM_Email","ADM_ID","ADM_Uname","ADM_name","ADM_password"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    document.getElementById("ADM_role").value = "";
    renderAdmins(getAdminUsers());
    updateAdminStats();
  } catch (err) {
    showMessage("userMsg", "❌ Error creating user.", "#fb7185");
    console.error(err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Create User"; }
  }
};

function updateAdminStats() {
  const admins = getAdminUsers();
  const counts = { admin: 0, editor: 0, viewer: 0 };
  admins.forEach(a => { if (counts[a.ADM_role] !== undefined) counts[a.ADM_role]++; });

  const animateCount = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    let cur = 0;
    const tick = () => { cur++; el.textContent = cur; if (cur < val) requestAnimationFrame(tick); };
    if (val > 0) requestAnimationFrame(tick);
    else el.textContent = "0";
  };

  animateCount("statAdmins",  counts.admin + counts.editor + counts.viewer);
  animateCount("statEditors", counts.editor);
  animateCount("statViewers", counts.viewer);
}

function renderAdmins(adminDocs) {
  const list = document.getElementById("userList");
  if (!list) return;

  if (!adminDocs.length) {
    list.innerHTML = `<div class="empty-state">No admins found.</div>`;
    return;
  }

  const roleColors = { admin: "#f59e0b", editor: "#3b82f6", viewer: "#10b981" };
  const roleIcons  = { admin: "⚡", editor: "✏️", viewer: "👁" };

  let html = `<div class="user-grid">`;
  adminDocs.forEach((admin, i) => {
    const color = roleColors[admin.ADM_role] || "#64748b";
    const icon  = roleIcons[admin.ADM_role]  || "";
    html += `
      <div class="user-row" style="animation-delay:${i * 0.06}s">
        <div class="user-row-avatar" style="background:${color}22;color:${color};border-color:${color}44">
          ${admin.ADM_name.charAt(0).toUpperCase()}
        </div>
        <div class="user-row-info">
          <span class="user-row-name">${admin.ADM_name}</span>
          <span class="user-row-uname">@${admin.ADM_Uname}</span>
          <span class="user-row-email">${admin.ADM_Email}</span>
        </div>
        <span class="user-row-role" style="background:${color}22;color:${color};border-color:${color}44">
          ${icon} ${admin.ADM_role}
        </span>
        <div class="user-row-actions">
          <button class="user-action-btn edit-btn" onclick="openEditAdmin('${admin.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  list.innerHTML = html;
}

// ── STUDENTS ──────────────────────────────────────────────────────────────────

function getFilteredSortedStudents() {
  let filtered = students;
  const searchValue = searchQuery.toString().trim().toLowerCase();
  const parsedFilter = parseSearchFilter(searchValue);

  if (parsedFilter?.type === "grade") {
    filtered = filtered.filter(s => (s.grade ?? "").toString().trim().toLowerCase() === parsedFilter.value);
  } else if (parsedFilter?.type === "department") {
    filtered = filtered.filter(s => (s.department ?? "").toString().trim().toLowerCase() === parsedFilter.value);
  } else if (searchValue) {
    filtered = filtered.filter(s =>
      [s.fullname, s.studentId, s.grade, s.role, s.department, s.status, s.email, s.phone, s.address, s.birthday, s.joinedYear]
        .filter(Boolean).some(v => v.toString().toLowerCase().includes(searchValue))
    );
  }

  return [...filtered].sort((a, b) => {
    const aVal = (a[sortOption] ?? "").toString().toLowerCase();
    const bVal = (b[sortOption] ?? "").toString().toLowerCase();
    return aVal.localeCompare(bVal, undefined, { numeric: true });
  });
}

function getExportStudents() {
  return getFilteredSortedStudents();
}

function renderStudents() {
  const list = document.getElementById("list");
  if (!list) return;

  const sorted = getFilteredSortedStudents();
  const searchValue = searchQuery.toString().trim().toLowerCase();

  if (!sorted.length) {
    const msg = searchValue
      ? "No students match your search."
      : "No students found yet. Add a member from the Add Student page.";
    list.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  if (viewMode === "table") {
    let html = `
      <div class="student-table">
        <div class="table-row header">
          <div>Name</div><div>ID</div><div>Grade</div>
          <div>Role</div><div>Status</div><div>Email</div>
          <div>Address</div><div>Birthday</div>
        </div>
    `;
    sorted.forEach((s, i) => {
      html += `
        <div class="table-row clickable-row" data-idx="${i}" style="animation-delay:${i * 0.04}s">
          <div>${s.fullname}</div><div>${s.studentId}</div><div>${s.grade}</div>
          <div>${s.role}</div><div>${s.status}</div><div>${s.email}</div>
          <div>${s.address || "—"}</div><div>${s.birthday || "—"}</div>
        </div>
      `;
    });
    html += `</div>`;
    list.innerHTML = html;

    // Bind row clicks
    list.querySelectorAll(".clickable-row").forEach(row => {
      row.addEventListener("click", () => {
        const idx = parseInt(row.getAttribute("data-idx"));
        openStudentPopup(sorted[idx]);
      });
    });
    return;
  }

  let html = `<div class="student-grid">`;
  sorted.forEach((s, i) => {
    const initials = (s.fullname || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const statusClass = s.status?.toLowerCase() === "active" ? "status-active" : "status-inactive";
    html += `
      <div class="card clickable-card" data-idx="${i}" style="animation-delay:${i * 0.05}s">
        <div class="card-top">
          <div class="card-avatar">${initials}</div>
          <div class="card-header-info">
            <h2>${s.fullname}</h2>
            <span class="status-badge ${statusClass}">${s.status || "—"}</span>
          </div>
        </div>
        <div class="card-body">
          <p><strong>ID</strong>    <span>${s.studentId}</span></p>
          <p><strong>Grade</strong> <span>${s.grade}</span></p>
          <p><strong>Role</strong>  <span>${s.role}</span></p>
          <p><strong>Dept</strong>  <span>${s.department}</span></p>
          <p><strong>Exp</strong>   <span>${s.experienceLevel}</span></p>
          <p><strong>Email</strong> <span>${s.email}</span></p>
          <p><strong>Address</strong> <span>${s.address || "—"}</span></p>
          <p><strong>Birthday</strong> <span>${s.birthday || "—"}</span></p>
        </div>
        <div class="card-footer-hint">Tap to view details →</div>
      </div>
    `;
  });
  html += `</div>`;
  list.innerHTML = html;

  // Bind card clicks
  list.querySelectorAll(".clickable-card").forEach(card => {
    card.addEventListener("click", () => {
      const idx = parseInt(card.getAttribute("data-idx"));
      openStudentPopup(sorted[idx]);
    });
  });
}

function downloadStudentSheet(studentsToExport) {
  const headers = [
    "Name", "Nickname", "ID", "Grade", "Role", "Department", "Status",
    "Experience", "Email", "Phone", "Address", "Birthday", "Joined Year", "Profile Image URL"
  ];
  const rows = studentsToExport.map(s => [
    s.fullname, s.nickname || "", s.studentId, s.grade, s.role, s.department,
    s.status, s.experienceLevel, s.email, s.phone, s.address, s.birthday, s.joinedYear,
    s.profileImageUrl || ""
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Set column widths for better table appearance
  ws['!cols'] = [
    { wch: 20 }, // Name
    { wch: 15 }, // Nickname
    { wch: 10 }, // ID
    { wch: 8 },  // Grade
    { wch: 18 }, // Role
    { wch: 12 }, // Department
    { wch: 8 },  // Status
    { wch: 12 }, // Experience
    { wch: 25 }, // Email
    { wch: 15 }, // Phone
    { wch: 20 }, // Address
    { wch: 12 }, // Birthday
    { wch: 12 }, // Joined Year
    { wch: 25 }  // Profile Image URL
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RCMU Students");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "RCMU_student_sheet.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

window.saveStudent = async function () {
  const user = requireAuth(["admin", "editor"]);
  if (!user) return;

  const fields = ["fullname","nickname","studentId","grade","role","department","status",
                  "experienceLevel","profileImageUrl","email","phone","address","birthday","joinedYear"];
  const required = ["fullname","studentId","grade","role","department","status","experienceLevel","email","phone","address","birthday","joinedYear"];

  const data = {};
  for (const f of fields) data[f] = document.getElementById(f)?.value.trim() || "";

  for (const f of required) {
    if (!data[f]) {
      showMessage("msg", `⚠️ ${f.replace(/([A-Z])/g, " $1")} is required.`, "#fb7185");
      return;
    }
  }

  const btn = document.querySelector(".form button");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  try {
    await addDoc(collection(db, "RCMU_DB"), { ...data, createdAt: new Date().toISOString() });
    showMessage("msg", "✅ Student saved successfully.", "#86efac");
    document.querySelectorAll(".form input, .form select").forEach(i => i.value = "");
  } catch (error) {
    showMessage("msg", "❌ Error saving student.", "#fb7185");
    console.error(error);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save Student"; }
  }
};

// ── PAGE INITS ────────────────────────────────────────────────────────────────

async function initAdminPage() {
  const panel = document.getElementById("adminPanel");
  if (!panel) return;

  const user = requireAuth(["admin"]);
  if (!user) return;

  updateHeaderUser();
  renderAdmins(getAdminUsers());
  updateAdminStats();
}

async function initStudentFormPage() {
  const user = getCurrentUser();
  updateHeaderUser();
  if (!user) {
    document.querySelectorAll(".logout-btn").forEach(b => b.style.display = "none");
    document.querySelectorAll('a[href="admin.html"]').forEach(a => a.style.display = "none");
  } else if (user.ADM_role !== "admin") {
    document.querySelectorAll('a[href="admin.html"]').forEach(a => a.style.display = "none");
  }
}

async function initStudentListPage() {
  const list = document.getElementById("list");
  if (!list) return;

  const user = requireAuth(["admin", "editor", "viewer"]);
  if (!user) return;
  updateHeaderUser();

  const addLink    = document.getElementById("addStudentLink");
  const adminLink  = document.getElementById("adminLink");

  if (user.ADM_role === "viewer" && addLink) addLink.style.display = "none";
  if (user.ADM_role === "admin" && adminLink) adminLink.style.display = "inline-flex";
  else if (adminLink) adminLink.style.display = "none";

  const cardsBtn    = document.getElementById("cardsViewBtn");
  const tableBtn    = document.getElementById("tableViewBtn");
  const downloadBtn = document.getElementById("downloadSheetBtn");
  const searchInput = document.getElementById("searchInput");
  const searchSugg  = document.getElementById("searchSuggestions");
  const sortSelect  = document.getElementById("sortSelect");

  if (cardsBtn) cardsBtn.addEventListener("click", () => {
    viewMode = "cards";
    cardsBtn.classList.add("active");
    tableBtn?.classList.remove("active");
    renderStudents();
  });

  if (tableBtn) tableBtn.addEventListener("click", () => {
    viewMode = "table";
    tableBtn.classList.add("active");
    cardsBtn?.classList.remove("active");
    renderStudents();
  });

  if (downloadBtn) downloadBtn.addEventListener("click", () => {
    const vis = getExportStudents();
    if (!vis.length) { alert("No student data to download."); return; }
    downloadStudentSheet(vis);
  });

  if (searchInput) {
    searchInput.addEventListener("input", e => { searchQuery = e.target.value; renderStudents(); });
    searchInput.addEventListener("focus", () => searchSugg?.classList.add("active"));
  }

  if (sortSelect) sortSelect.addEventListener("change", e => { sortOption = e.target.value; renderStudents(); });

  if (searchSugg) {
    searchSugg.addEventListener("click", e => {
      const btn = e.target.closest("button[data-suggestion]");
      if (!btn) return;
      const sug = btn.getAttribute("data-suggestion") || "";
      searchQuery = sug;
      if (searchInput) { searchInput.value = sug; searchInput.focus(); }
      searchSugg.classList.remove("active");
      renderStudents();
    });
  }

  document.addEventListener("click", e => {
    if (!searchSugg || !searchInput) return;
    if (e.target === searchInput || searchSugg.contains(e.target)) return;
    searchSugg.classList.remove("active");
  });

  onSnapshot(collection(db, "RCMU_DB"), snap => {
    students = [];
    snap.forEach(d => students.push({ _docId: d.id, ...d.data() }));
    renderStudents();
  });
}

// ── ROUTER ────────────────────────────────────────────────────────────────────

let currentPage = window.location.pathname.split("/").pop().split("?")[0].split("#")[0] || "index.html";

if      (currentPage === "admin.html") initAdminPage();
else if (currentPage === "add.html")   initStudentFormPage();
else if (currentPage === "index.html") initStudentListPage();