document.addEventListener('DOMContentLoaded', () => {
  const authSection = document.getElementById('auth-section');
  const mainSection = document.getElementById('main-section');
  const tokenInput = document.getElementById('token-input');
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const openDashboardBtn = document.getElementById('open-dashboard');

  // Check if token already exists
  chrome.storage.local.get(['zaplynx_token'], (result) => {
    if (result.zaplynx_token) {
      showMain();
    } else {
      showAuth();
    }
  });

  connectBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token) {
      chrome.storage.local.set({ zaplynx_token: token }, () => {
        showMain();
      });
    }
  });

  disconnectBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['zaplynx_token'], () => {
      showAuth();
    });
  });

  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://zaplynx.lovable.app/dashboard' });
  });

  function showMain() {
    authSection.style.display = 'none';
    mainSection.style.display = 'block';
  }

  function showAuth() {
    authSection.style.display = 'block';
    mainSection.style.display = 'none';
  }
});
