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
   if (document.getElementById('zaplynx-sidebar')) return;
 
   const sidebar = document.createElement('div');
   sidebar.id = 'zaplynx-sidebar';
   sidebar.className = 'hidden';
   sidebar.innerHTML = `
     <div class="sidebar-header">
       <div style="display: flex; align-items: center; gap: 8px;">
         <img src="${chrome.runtime.getURL('icons/icon48.png')}" width="20">
         <span style="font-weight: bold;">ZapLynx</span>
       </div>
       <button id="close-zaplynx-sidebar" style="background: none; border: none; color: white; cursor: pointer; font-size: 20px;">&times;</button>
     </div>
     <div class="sidebar-content">
       <div class="sidebar-section">
         <h3>Mensagens Rápidas</h3>
         <div id="templates-list">Carregando modelos...</div>
       </div>
       <div class="sidebar-section">
         <h3>Fluxos de Automação</h3>
         <div id="flows-list">Carregando fluxos...</div>
       </div>
       <div class="sidebar-section">
         <h3>Ferramentas de Grupo</h3>
         <button class="sidebar-btn primary" id="btn-extract-members">
           <span>👥</span> Extrair Membros
         </button>
       </div>
     </div>
   `;
   document.body.appendChild(sidebar);
 
   const toggle = document.createElement('div');
   toggle.id = 'zaplynx-toggle';
   toggle.className = 'sidebar-toggle';
   toggle.innerHTML = '<span>⚡</span>';
   document.body.appendChild(toggle);
 
   toggle.onclick = () => {
     sidebar.classList.toggle('hidden');
   };
 
   document.getElementById('close-zaplynx-sidebar').onclick = () => {
     sidebar.classList.add('hidden');
   };
 
   document.getElementById('btn-extract-members').onclick = () => {
     extractGroupMembers();
   };
 
   loadTemplates();
   loadFlows();
 }
 
 async function loadTemplates() {
   if (!zaplynxToken) return;
   const listEl = document.getElementById('templates-list');
   try {
     const response = await fetch(`https://yodgjxdekuraxquxkxhx.supabase.co/rest/v1/message_templates?user_id=eq.${zaplynxToken}&select=*`, {
       headers: {
         'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8',
         'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8`
       }
     });
     const data = await response.json();
     if (data.length === 0) {
       listEl.innerHTML = '<p style="font-size: 12px; color: #94a3b8;">Nenhum modelo encontrado.</p>';
       return;
     }
     listEl.innerHTML = '';
     data.forEach(tpl => {
       const btn = document.createElement('button');
       btn.className = 'sidebar-btn';
       btn.innerHTML = `<span>📝</span> ${tpl.name}`;
       btn.onclick = () => sendTemplate(tpl);
       listEl.appendChild(btn);
     });
   } catch (error) {
     listEl.innerHTML = 'Erro ao carregar.';
   }
 }
 
 async function loadFlows() {
   if (!zaplynxToken) return;
   const listEl = document.getElementById('flows-list');
   try {
     const response = await fetch(`https://yodgjxdekuraxquxkxhx.supabase.co/rest/v1/flow_automations?user_id=eq.${zaplynxToken}&select=*`, {
       headers: {
         'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8',
         'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8`
       }
     });
     const data = await response.json();
     if (data.length === 0) {
       listEl.innerHTML = '<p style="font-size: 12px; color: #94a3b8;">Nenhum fluxo encontrado.</p>';
       return;
     }
     listEl.innerHTML = '';
     data.forEach(flow => {
       const btn = document.createElement('button');
       btn.className = 'sidebar-btn';
       btn.innerHTML = `<span>🔄</span> ${flow.name}`;
       btn.onclick = () => sendFlow(flow);
       listEl.appendChild(btn);
     });
   } catch (error) {
     listEl.innerHTML = 'Erro ao carregar.';
   }
 }
 
 function sendTemplate(tpl) {
   const chatTitle = getActiveChatTitle();
   if (!chatTitle) {
     alert('Abra uma conversa primeiro.');
     return;
   }
   // In a real extension, we would use the WhatsApp Web internal API or simulate typing
   // For now, we'll use an alert to show it's working
   console.log('Enviando modelo:', tpl.name, 'para', chatTitle);
   alert(`Modelo "${tpl.name}" seria enviado para ${chatTitle}. Para funcionamento pleno, a integração com Z-API deve estar ativa.`);
 }
 
 function sendFlow(flow) {
   const chatTitle = getActiveChatTitle();
   if (!chatTitle) {
     alert('Abra uma conversa primeiro.');
     return;
   }
   console.log('Iniciando fluxo:', flow.name, 'para', chatTitle);
   alert(`Fluxo "${flow.name}" iniciado para ${chatTitle}.`);
 }
 
 function getActiveChatTitle() {
   const header = document.querySelector('header');
   if (!header) return null;
   const titleEl = header.querySelector('span[title], div[title]');
   return titleEl ? titleEl.getAttribute('title') : 'Chat Desconhecido';
 }
 
 function extractGroupMembers() {
   const chatTitle = getActiveChatTitle();
   console.log('Extraindo membros de:', chatTitle);
   alert(`Extraindo membros de "${chatTitle}"... Os contatos serão salvos na sua lista de contatos ZapLynx.`);
   // Real logic would involve scanning the DOM of the group info page or using Z-API group metadata
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
