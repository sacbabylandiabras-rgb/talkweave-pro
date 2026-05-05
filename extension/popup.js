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
     chrome.tabs.create({ url: 'https://app.zaplynx.com.br/dashboard' });
   });
 
   document.getElementById('btn-templates').addEventListener('click', () => {
     alert('Use o painel lateral no WhatsApp Web para selecionar e enviar modelos.');
   });
 
   document.getElementById('btn-flows').addEventListener('click', () => {
     alert('Use o painel lateral no WhatsApp Web para selecionar e enviar fluxos.');
   });
 
   document.getElementById('btn-extract').addEventListener('click', () => {
     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
       chrome.tabs.sendMessage(tabs[0].id, { action: 'extract_members' });
     });
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
