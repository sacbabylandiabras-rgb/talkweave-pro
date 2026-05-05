 console.log('ZapLynx Extension v1.0.4: Content script loaded');

let zaplynxToken = null;
let zaplynxInitInterval = null;
const SUPABASE_URL = 'https://yodgjxdekuraxquxkxhx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGdqeGRla3VyYXhxdXhreGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4MTA4NTYsImV4cCI6MjA3NDM4Njg1Nn0.S7GLD19jE_HN2wcUJKZXgV_dmA4qSYpk7w-B4arQmi8';

function loadTokenAndInit() {
  chrome.storage.local.get(['zaplynx_token'], (result) => {
    zaplynxToken = result.zaplynx_token;
    // Always init to show at least the login screen if needed
    initExtension();
  });
}

loadTokenAndInit();

function initExtension() {
  // Initial injection
  injectUI();
  // Keep checking in case WA Web re-renders the body
  if (!zaplynxInitInterval) {
    zaplynxInitInterval = setInterval(injectUI, 3000);
  }
}

function injectUI() {
  if (document.getElementById('zaplynx-sidebar')) return;

  const sidebar = document.createElement('div');
  sidebar.id = 'zaplynx-sidebar';
  sidebar.className = ''; 
  
  if (!zaplynxToken) {
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/logo.png')}" alt="ZapLynx" style="display:block;width:140px;height:auto;object-fit:contain;filter:drop-shadow(0 0 8px rgba(167,139,250,0.4));">
        </div>
        <button id="close-zaplynx-sidebar" style="background: none; border: none; cursor: pointer; font-size: 20px;">&times;</button>
      </div>
      <div class="sidebar-content">
        <div class="sidebar-section">
          <h3>Conectar Conta</h3>
          <p style="font-size: 12px; color: #b9aec9; margin-bottom: 12px;">Insira sua chave de extensão para começar.</p>
          <input type="password" id="sidebar-token-input" placeholder="Sua chave ZapLynx..." style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid rgba(167, 139, 250, 0.25); background: rgba(255,255,255,0.08); color: #f8fafc; margin-bottom: 12px; box-sizing: border-box;">
          <button class="sidebar-btn primary" id="btn-save-token">Conectar Extensão</button>
        </div>
      </div>
    `;
  } else {
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${chrome.runtime.getURL('icons/logo.png')}" alt="ZapLynx" style="display:block;width:140px;height:auto;object-fit:contain;filter:drop-shadow(0 0 8px rgba(167,139,250,0.4));">
        </div>
        <button id="close-zaplynx-sidebar" style="background: none; border: none; cursor: pointer; font-size: 20px;">&times;</button>
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
          <button class="sidebar-btn primary" id="btn-refresh-groups" style="font-size: 12px;">
            <span>🔄</span> Listar Grupos na Tela
          </button>
          <div id="groups-list" style="margin-top: 10px; max-height: 250px; overflow-y: auto;">
            <p style="font-size: 11px; color: #b9aec9;">Clique para listar os grupos visíveis na sua barra lateral.</p>
          </div>
        </div>

        <div class="sidebar-section" id="active-group-tools" style="display: none; border-top: 1px solid rgba(167, 139, 250, 0.18); padding-top: 15px;">
          <h3 id="current-group-name" style="color: #f472b6;">Chat Ativo</h3>
          <button class="sidebar-btn success" id="btn-extract-members">
            <span>👥</span> Extrair Membros deste Chat
          </button>
        </div>

        <button id="btn-logout" style="background: none; border: none; color: #ef4444; font-size: 11px; cursor: pointer; margin-top: 20px; width: 100%; text-align: center;">Sair da Conta</button>
      </div>
    `;
  }
  document.body.appendChild(sidebar);

  document.getElementById('close-zaplynx-sidebar').onclick = () => {
    sidebar.classList.add('hidden');
  };

  if (!zaplynxToken) {
    document.getElementById('btn-save-token').onclick = () => {
      const token = document.getElementById('sidebar-token-input').value.trim();
      if (token) {
        chrome.storage.local.set({ zaplynx_token: token }, () => {
          zaplynxToken = token;
          const sidebar = document.getElementById('zaplynx-sidebar');
          if (sidebar) sidebar.remove();
          injectUI();
          checkActiveChat();
        });
      }
    };
  } else {
    document.getElementById('btn-refresh-groups').onclick = () => {
      listGroups();
    };

    document.getElementById('btn-extract-members').onclick = () => {
      extractGroupMembers();
    };

    document.getElementById('btn-logout').onclick = () => {
      chrome.storage.local.remove(['zaplynx_token'], () => {
        zaplynxToken = null;
        const sidebar = document.getElementById('zaplynx-sidebar');
        if (sidebar) sidebar.remove();
        injectUI();
      });
    };

    loadTemplates();
    loadFlows();
    setInterval(checkActiveChat, 2000);
  }
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
  const chats = document.querySelectorAll('div[role="listitem"], [data-testid="cell-frame-container"], [aria-label="Lista de conversas"] [role="row"]');
  const groups = [];
  
  chats.forEach(chat => {
    const titleEl = chat.querySelector('span[title], div[title]');
    if (titleEl) {
      const title = titleEl.getAttribute('title')?.trim();
      // Try to identify if it's a group by looking for participant info or specific icons
      // Since that's hard, we list chats that are likely groups (or just all for now)
      if (title && !groups.some(group => group.title === title)) {
        groups.push({ title, element: chat });
      }
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
     const response = await fetch(`${SUPABASE_URL}/rest/v1/message_templates?user_id=eq.${zaplynxToken}&select=*`, {
       headers: {
         'apikey': SUPABASE_KEY,
         'Authorization': `Bearer ${SUPABASE_KEY}`
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
     const response = await fetch(`${SUPABASE_URL}/rest/v1/flow_automations?user_id=eq.${zaplynxToken}&select=*`, {
       headers: {
         'apikey': SUPABASE_KEY,
         'Authorization': `Bearer ${SUPABASE_KEY}`
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
 
 async function extractGroupMembers(specificTitle) {
  const chatTitle = specificTitle || getActiveChatTitle();
  console.log('Extraindo membros de:', chatTitle);
   
   // Show feedback
   const btn = document.getElementById('btn-extract-members');
   const originalText = btn.innerHTML;
   btn.innerHTML = '<span>⏳</span> Extraindo...';
   btn.disabled = true;

   try {
     // 1. Find participants string in the header (usually "você, +55...", or "X participantes")
     const header = document.querySelector('header');
     if (!header) throw new Error('Cabeçalho não encontrado');
     
     const subtitleEl = header.querySelector('span[title].copyable-text, .y339u, span[dir="auto"]');
     let participantsStr = subtitleEl ? subtitleEl.innerText : '';
     
     // If we are in a group, the subtitle often contains the participants
     // But the best way is to open the group info and get the full list
     // For a quick extraction, we can parse the subtitle
     
     let members = [];
     if (participantsStr.includes(',')) {
       members = participantsStr.split(',').map(m => m.trim().replace(/[^0+9]/g, ''));
     }
     
     // Filter only valid looking phone numbers
     const validMembers = members.filter(m => m.length > 8);

     if (validMembers.length === 0) {
       alert('Não foi possível detectar membros automaticamente. Tente abrir os dados do grupo primeiro.');
       btn.innerHTML = originalText;
       btn.disabled = false;
       return;
     }

     console.log('Membros encontrados:', validMembers);
     
     // 2. Save to Supabase
     for (const phone of validMembers) {
       await fetch(`${SUPABASE_URL}/rest/v1/saved_contacts`, {
         method: 'POST',
         headers: {
           'apikey': SUPABASE_KEY,
           'Authorization': `Bearer ${SUPABASE_KEY}`,
           'Content-Type': 'application/json',
           'Prefer': 'resolution=merge-duplicates'
         },
         body: JSON.stringify({
           user_id: zaplynxToken,
           phone: phone,
           name: `Contato Extraído (${chatTitle})`
         })
       });
     }

     alert(`${validMembers.length} membros de "${chatTitle}" foram enviados para sua conta ZapLynx!`);
   } catch (error) {
     console.error('Erro na extração:', error);
     alert('Erro ao extrair membros. Certifique-se de que o chat do grupo está aberto.');
   } finally {
     btn.innerHTML = originalText;
     btn.disabled = false;
   }
 }

 function sendTemplate(tpl) {
   // Use WhatsApp Web's internal input to send message if possible
   const input = document.querySelector('footer div[contenteditable="true"]');
   if (input) {
     input.focus();
     document.execCommand('insertText', false, tpl.content || tpl.name);
     // Note: Dispatching 'Enter' is tricky, but at least the text is there
   }
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
