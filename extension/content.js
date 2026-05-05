console.log('ZapLynx Extension: Content script loaded');

let zaplynxToken = null;

chrome.storage.local.get(['zaplynx_token'], (result) => {
  zaplynxToken = result.zaplynx_token;
  if (zaplynxToken) {
    initExtension();
  }
});

function initExtension() {
  setInterval(() => {
    injectUI();
  }, 2000);
}

function injectUI() {
  // Check if we are in a chat
  const header = document.querySelector('header');
  if (header && !document.getElementById('zaplynx-indicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'zaplynx-indicator';
    indicator.innerHTML = `
      <div style="background: #0284c7; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 10px; cursor: pointer;">
        ZapLynx Ativo
      </div>
    `;
    indicator.onclick = () => {
      alert('ZapLynx está monitorando este chat para sincronização.');
    };
    header.appendChild(indicator);
  }
}

// Message listener for actions from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape_contacts') {
    const contacts = scrapeContacts();
    sendResponse({ contacts });
  }
  return true;
});

function scrapeContacts() {
  // Mock scraping for now - in a real scenario, this would traverse the DOM of the group member list
  console.log('ZapLynx: Extraindo contatos...');
  return [];
}
