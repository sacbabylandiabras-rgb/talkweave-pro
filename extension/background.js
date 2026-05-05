chrome.action.onClicked.addListener(async (tab) => {
  try {
    const url = tab?.url || '';
    if (url.includes('web.whatsapp.com')) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' });
      } catch (e) {
        // Content script not ready — inject it then retry
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['styles.css']
        });
        setTimeout(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' }).catch(() => {});
        }, 500);
      }
    } else {
      // Not on WhatsApp Web — open it in a new tab
      chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
    }
  } catch (err) {
    console.error('ZapLynx action error:', err);
  }
});
