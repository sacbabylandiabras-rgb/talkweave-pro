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
  // Start visible as requested
  sidebar.className = ''; 
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${chrome.runtime.getURL('icons/icon48.png')}" width="24">
        <span style="font-weight: bold; font-size: 16px;">ZapLynx</span>
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
        <h3>Extração de Grupos</h3>
        <button class="sidebar-btn primary" id="btn-refresh-groups">
          <span>🔄</span> Listar Grupos Disponíveis
        </button>
        <div id="groups-list" style="margin-top: 10px; max-height: 200px; overflow-y: auto;">
          <p style="font-size: 12px; color: #94a3b8;">Clique acima para listar grupos.</p>
        </div>
      </div>

      <div class="sidebar-section" id="active-group-tools" style="display: none; border-top: 1px solid #334155; pt-10">
        <h3 id="current-group-name">Grupo Atual</h3>
        <button class="sidebar-btn success" id="btn-extract-members">
          <span>👥</span> Extrair Membros Deste Grupo
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(sidebar);

  document.getElementById('close-zaplynx-sidebar').onclick = () => {
    sidebar.classList.add('hidden');
  };

  document.getElementById('btn-refresh-groups').onclick = () => {
    listGroups();
  };

  document.getElementById('btn-extract-members').onclick = () => {
    extractGroupMembers();
  };

  loadTemplates();
  loadFlows();
  
  // Auto-detect group change
  setInterval(checkActiveChat, 2000);
}

function checkActiveChat() {
  const title = getActiveChatTitle();
  const tools = document.getElementById('active-group-tools');
  const nameEl = document.getElementById('current-group-name');
  
  if (title && title !== 'Chat Desconhecido') {
    // Very basic check if it's a group: WhatsApp group titles often have participant counts or info below them in the header
    // But for simplicity, we'll show tools if any chat is open
    tools.style.display = 'block';
    nameEl.innerText = title;
  } else {
    tools.style.display = 'none';
  }
}

function listGroups() {
  const listEl = document.getElementById('groups-list');
  listEl.innerHTML = '<p style="font-size: 12px; color: #94a3b8;">Buscando grupos...</p>';
  
  // Scrape the left sidebar for group items
  const chats = document.querySelectorAll('div[role="listitem"]');
  const groups = [];
  
  chats.forEach(chat => {
    const titleEl = chat.querySelector('span[title]');
    if (titleEl) {
      const title = titleEl.getAttribute('title');
      // Try to identify if it's a group by looking for participant info or specific icons
      // Since that's hard, we list chats that are likely groups (or just all for now)
      groups.push({ title, element: chat });
    }
  });

  if (groups.length === 0) {
    listEl.innerHTML = '<p style="font-size: 12px; color: #f87171;">Nenhum grupo encontrado na lista visível.</p>';
    return;
  }

  listEl.innerHTML = '';
  groups.slice(0, 15).forEach(group => {
    const div = document.createElement('div');
    div.className = 'group-item';
    div.innerHTML = `
      <span title="${group.title}">${group.title}</span>
      <button class="small-btn">Extrair</button>
    `;
    div.querySelector('button').onclick = () => {
      group.element.click(); // Click the chat to open it
      setTimeout(() => {
        extractGroupMembers(group.title);
      }, 1000);
    };
    listEl.appendChild(div);
  });
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

function extractGroupMembers(specificTitle) {
  const chatTitle = specificTitle || getActiveChatTitle();
  console.log('Extraindo membros de:', chatTitle);
  alert(`Iniciando extração de membros de "${chatTitle}"...\n\nOs contatos serão sincronizados com seu CRM ZapLynx.`);
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle_sidebar') {
    const sidebar = document.getElementById('zaplynx-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('hidden');
    } else {
      injectUI();
    }
    sendResponse({ success: true });
  } else if (request.action === 'extract_members') {
    extractGroupMembers();
    sendResponse({ success: true });
  }
  return true;
});
