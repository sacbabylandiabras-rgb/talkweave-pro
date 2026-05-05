chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes('web.whatsapp.com')) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' });
  }
});
