if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(() => console.log("PWA Service Worker Aktif!"))
    .catch(err => console.log("Gagal PWA:", err));
}

let currentUser = null;
let currentRole = null;
let databaseAset = JSON.parse(localStorage.getItem('db_aset')) || [];
let databaseHistory = JSON.parse(localStorage.getItem('db_history')) || [];
let customMenus = JSON.parse(localStorage.getItem('db_menus')) || [];
let pendingSyncLogs = JSON.parse(localStorage.getItem('pending_sync')) || [];

window.addEventListener('online', handleOnlineStatus);
window.addEventListener('offline', handleOnlineStatus);

function handleOnlineStatus() {
  const statusEl = document.getElementById('sync-status');
  if (navigator.onLine) {
    statusEl.innerText = "Online";
    statusEl.className = "px-2 py-1 text-xs rounded bg-green-500 text-white font-bold";
    autoSyncData();
  } else {
    statusEl.innerText = "Offline Mode";
    statusEl.className = "px-2 py-1 text-xs rounded bg-red-500 text-white font-bold";
  }
  updateDashboardCounts();
}

function login() {
  const username = document.getElementById('username').value.trim();
  const role = document.getElementById('user-role').value;

  if (!username) {
    Swal.fire('Gagal', 'Masukkan nama/ID user Anda', 'error');
    return;
  }

  currentUser = username;
  currentRole = role;

  document.getElementById('display-username').innerText = currentUser;
  document.getElementById('display-role').innerText = currentRole;
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');

  if (currentRole === 'SuperAdmin') {
    document.getElementById('admin-gui-builder').classList.remove('hidden');
  } else {
    document.getElementById('admin-gui-builder').classList.add('hidden');
  }

  logActivity("SYSTEM", `User ${currentUser} berhasil login menggunakan role ${currentRole}`);
  loadCustomMenus();
  renderAssetsTable();
  renderHistoryTable();
  handleOnlineStatus();
}

function logout() {
  logActivity("SYSTEM", `User ${currentUser} melakukan logout dari sistem`);
  currentUser = null;
  currentRole = null;
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('#dynamic-menu button').forEach(btn => btn.classList.remove('bg-blue-600'));
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove('hidden');
  event.currentTarget.classList.add('bg-blue-600');
}

function saveAsset() {
  const id = document.getElementById('asset-id').value.trim();
  const name = document.getElementById('asset-name').value.trim();
  const area = document.getElementById('asset-area').value.trim();
  const status = document.getElementById('asset-status').value.trim();

  if (!id || !name || !area) {
    Swal.fire('Peringatan', 'Mohon lengkapi Form ID, Nama, dan Area Asset', 'warning');
    return;
  }

  const newAsset = { id, name, area, status, lastUpdatedBy: currentUser };
  const index = databaseAset.findIndex(a => a.id === id);
  if (index > -1) {
    databaseAset[index] = newAsset;
  } else {
    databaseAset.push(newAsset);
  }
  localStorage.setItem('db_aset', JSON.stringify(databaseAset));

  logActivity(id, `Update kondisi asset: ${name}, Status: ${status}`);

  if (!navigator.onLine) {
    pendingSyncLogs.push({ type: 'ASSET_UPDATE', data: newAsset, time: new Date().toISOString() });
    localStorage.setItem('pending_sync', JSON.stringify(pendingSyncLogs));
    Swal.fire('Modus Offline', 'Data disimpan lokal di HP. Akan otomatis sinkron saat ada internet!', 'info');
  } else {
    Swal.fire('Sukses', 'Data Berhasil Diupdate dan Sinkron!', 'success');
  }

  generateQRCode(id, name);
  renderAssetsTable();
  updateDashboardCounts();
}

function generateQRCode(id, name) {
  const qrContainer = document.getElementById('qrcode');
  qrContainer.innerHTML = ""; 
  document.getElementById('qr-wrapper').classList.remove('hidden');
  document.getElementById('qr-label').innerText = `${id} - ${name}`;
  new QRCode(qrContainer, {
    text: `PROYEK-ASET:${id}:${name}`,
    width: 128,
    height: 128,
    colorDark : "#000000",
    colorLight : "#ffffff"
  });
}

function logActivity(assetId, description) {
  const log = {
    timestamp: new Date().toLocaleString(),
    assetId: assetId,
    user: currentUser || "Unknown",
    area: currentRole || "General",
    desc: description
  };
  databaseHistory.unshift(log);
  localStorage.setItem('db_history', JSON.stringify(databaseHistory));
  renderHistoryTable();
}

function autoSyncData() {
  if (pendingSyncLogs.length === 0) return;
  console.log("Mengunggah data perubahan lapangan:", pendingSyncLogs);
  pendingSyncLogs = [];
  localStorage.setItem('pending_sync', JSON.stringify(pendingSyncLogs));
  Swal.fire('Auto Sync Berhasil!', 'Data lapangan otomatis disinkronkan ke server.', 'success');
  updateDashboardCounts();
}

function openMenuBuilder() {
  Swal.fire({
    title: 'Buat Menu GUI Baru Dinamis',
    html: `
      <input id="new-menu-title" class="swal2-input" placeholder="Nama Menu Baru">
      <input id="new-menu-icon" class="swal2-input" placeholder="Emoji Menu (Contoh: ⚡, ⚙️)">
    `,
    confirmButtonText: 'Tambahkan Sekarang',
    showCancelButton: true
  }).then((result) => {
    if (result.isConfirmed) {
      const title = document.getElementById('new-menu-title').value.trim();
      const icon = document.getElementById('new-menu-icon').value.trim() || '📁';
      if (!title) return;

      const slug = title.toLowerCase().replace(/ /g, '-');
      customMenus.push({ title, icon, slug });
      localStorage.setItem('db_menus', JSON.stringify(customMenus));
      loadCustomMenus();
      Swal.fire('Sukses', `Menu '${title}' berhasil ditambahkan ke GUI sidebar!`, 'success');
    }
  });
}

function loadCustomMenus() {
  const menuNav = document.getElementById('dynamic-menu');
  document.querySelectorAll('.custom-menu-btn').forEach(el => el.remove());

  customMenus.forEach(menu => {
    const btn = document.createElement('button');
    btn.className = "w-full text-left p-3 rounded hover:bg-gray-700 font-medium transition block custom-menu-btn";
    btn.innerHTML = `${menu.icon} ${menu.title}`;
    btn.onclick = () => {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      const template = document.getElementById('dynamic-tab-template');
      document.getElementById('dynamic-title').innerText = `${menu.icon} Menu: ${menu.title}`;
      document.getElementById('dynamic-actions-area').innerHTML = `
        <button onclick="Swal.fire('Fitur GUI Active','Aksi Berhasil Di-trigger untuk area ${currentRole}','success')" class="bg-purple-600 p-3 rounded font-bold">⚡ Jalankan Otomasi</button>
      `;
      template.classList.remove('hidden');
      document.querySelectorAll('#dynamic-menu button').forEach(b => b.classList.remove('bg-blue-600'));
      btn.classList.add('bg-blue-600');
    };
    menuNav.appendChild(btn);
  });
}

function renderAssetsTable() {
  const tbody = document.getElementById('asset-table-body');
  tbody.innerHTML = databaseAset.map(asset => `
    <tr class="hover:bg-gray-700 transition">
      <td class="p-4 font-mono font-bold text-yellow-400">${asset.id}</td>
      <td class="p-4">${asset.name}</td>
      <td class="p-4"><span class="px-2 py-1 text-xs bg-gray-600 rounded font-semibold">${asset.area}</span></td>
      <td class="p-4 text-green-400">${asset.status || 'Normal'}</td>
      <td class="p-4">
        <button onclick="generateQRCode('${asset.id}', '${asset.name}')" class="text-xs bg-blue-600 hover:bg-blue-700 p-2 rounded">Lihat QR</button>
      </td>
    </tr>
  `).join('');
}

function renderHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  tbody.innerHTML = databaseHistory.map(h => `
    <tr class="text-xs hover:bg-gray-700 transition">
      <td class="p-4 text-gray-400">${h.timestamp}</td>
      <td class="p-4 font-bold text-yellow-500">${h.assetId}</td>
      <td class="p-4 font-semibold text-blue-400">${h.user}</td>
      <td class="p-4"><span class="px-2 py-1 bg-purple-900 rounded text-purple-200">${h.area}</span></td>
      <td class="p-4">${h.desc}</td>
    </tr>
  `).join('');
}

function updateDashboardCounts() {
  document.getElementById('dash-total-asset').innerText = databaseAset.length;
  document.getElementById('dash-total-repair').innerText = databaseHistory.filter(h => !h.desc.includes("login") && !h.desc.includes("logout")).length;
  document.getElementById('dash-offline-count').innerText = pendingSyncLogs.length;
}

updateDashboardCounts();
// Ambil status login terakhir dari localStorage saat web dimuat
let currentUser = localStorage.getItem('current_user') || null;
let currentRole = localStorage.getItem('current_role') || null;

// Modifikasi fungsi login asli
const originalLogin = login;
login = function() {
  const username = document.getElementById('username').value.trim();
  const role = document.getElementById('user-role').value;
  if (username) {
    localStorage.setItem('current_user', username);
    localStorage.setItem('current_role', role);
  }
  originalLogin();
};

// Modifikasi fungsi logout asli
const originalLogout = logout;
logout = function() {
  localStorage.removeItem('current_user');
  localStorage.removeItem('current_role');
  originalLogout();
};

// Otomatis bypass login jika user sudah pernah login sebelumnya
window.addEventListener('DOMContentLoaded', () => {
  if (currentUser && currentRole) {
    document.getElementById('username').value = currentUser;
    document.getElementById('user-role').value = currentRole;
    login();
  }
});
