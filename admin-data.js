// ─────────────────────────────────────────────────────────────────────────────
// RCMU Admin Data  |  Passwords are SHA-256 hashed — never stored in plaintext
// ─────────────────────────────────────────────────────────────────────────────

// Internal helper: SHA-256 via Web Crypto API
async function _sha256(msg) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(msg)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Expose globally so login.html can use it
window._sha256 = _sha256;

// ── Admin accounts (passwords stored as SHA-256 hashes) ──────────────────────
const defaultManualAdmins = [
  {
    id: "ADM-001",
    ADM_ID: "ADM001",
    ADM_Uname: "Sasindu",
    ADM_name: "Sasindu Ruwaneka",
    ADM_Email: "sasindu.rcm@gmail.com",
    ADM_password: "f18af7408694f0d75c6ed44ea0cd9a41ce2ca243e104f783cdeddf8260475802",
    ADM_role: "admin"
  },
  {
    id: "ADM-002",
    ADM_ID: "ADM002",
    ADM_Uname: "Desandu",
    ADM_name: "Desandu Chithmal",
    ADM_Email: "desanduchithmal027@gmail.com",
    ADM_password: "b1a7a7cb9ada29378cb2a048e199a5f8db166e74d4e1fd0a3d9d5703977cd563",
    ADM_role: "admin"
  },
  {
    id: "EDT-001",
    ADM_ID: "EDT001",
    ADM_Uname: "Chithum",
    ADM_name: "Chithum Kithmaka",
    ADM_Email: "chithumlk2009@gmail.com",
    ADM_password: "1f25993d895d4f2d6a5a30779196f2919227ce91535d19e801e859da61b924a2",
    ADM_role: "editor"
  },
  {
    id: "VIEW-001",
    ADM_ID: "VIEW001",
    ADM_Uname: "Pasan",
    ADM_name: "Pasan Vidahanapathirana",
    ADM_Email: "pasansvpathirana10@gmail.com",
    ADM_password: "e01c3ecf3cd51fb20cd65c8ffe27af275e2cdaaa0ab8716d5f8ac970ef731cd5",
    ADM_role: "viewer"
  }
];

const storedAdmins = localStorage.getItem("rcmu_manual_admins");
window.manualAdmins = storedAdmins ? JSON.parse(storedAdmins) : defaultManualAdmins;

const migratedAdmins = window.manualAdmins.map(admin => {
  if (admin.ADM_Uname === "asindu") admin.ADM_Uname = "Sasindu";
  if (admin.ADM_name === "asindu" || admin.ADM_name === "Asindu") admin.ADM_name = "Sasindu Ruwaneka";
  if (admin.ADM_name) admin.ADM_name = admin.ADM_name.trim();
  return admin;
});
window.manualAdmins = migratedAdmins;

window.saveManualAdmins = function () {
  localStorage.setItem("rcmu_manual_admins", JSON.stringify(window.manualAdmins));
};

if (storedAdmins && JSON.stringify(migratedAdmins) !== storedAdmins) {
  window.saveManualAdmins();
}

window.RCMU_ROLES = {
  admin:  { label: '⚡ Admin',  desc: 'Full access',         color: '#f59e0b', canMark: true,  canEdit: true,  canAdmin: true  },
  editor: { label: '✏️ Editor', desc: 'Add & edit students', color: '#3b82f6', canMark: true,  canEdit: true,  canAdmin: false },
  viewer: { label: '👁 Viewer', desc: 'Mark duty & view',    color: '#10b981', canMark: true,  canEdit: false, canAdmin: false }
};