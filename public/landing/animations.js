/* ============================================================
   ZapLynx — animations.js
   Pac-Man hero strip, gateway dashboard, agent chat, IG scene
   ============================================================ */
(function () {
  'use strict';

  const fmt = (n) => Math.round(n).toLocaleString('pt-BR');
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const onView = (el, cb, threshold) => {
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { cb(); obs.disconnect(); } });
    }, { threshold: threshold || 0.3 });
    obs.observe(el);
  };

  /* ========================================================
     GATEWAY DASHBOARD MOCK
     ======================================================== */
  const RAW = [980,1240,1100,1580,1420,2100,1880,2450,2200,2980,2700,3350,3100,3800,3500,4300,3900,5100,4600,5900,5300,6700,6100,7500,6900,8600,8100,10200,11400,12847];

  function gatewayHTML(canvasId) {
    return `
      <div class="gw-head">
        <div class="gw-brand">
          <div class="ic"><svg viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,10 6,5 10,8 14,3"/></svg></div>
          <span class="nm">ZapLynxPay</span>
        </div>
        <div class="gw-live"><span class="d"></span>ao vivo</div>
      </div>
      <div class="gw-kpis">
        <div class="gw-kpi"><div class="k-l">Vendas hoje</div><div class="k-v accent" data-kpi="12847" data-pre="R$ ">R$ 0</div><div class="k-s"><span class="up" data-kpi="34" data-suf="%">↑ 0%</span> <span class="neu">vs ontem</span></div></div>
        <div class="gw-kpi"><div class="k-l">Transações</div><div class="k-v" data-kpi="148">0</div><div class="k-s"><span class="up" data-kpi="22" data-suf="%">↑ 0%</span> <span class="neu">vs ontem</span></div></div>
        <div class="gw-kpi"><div class="k-l">Conversão</div><div class="k-v" data-kpi="73.4" data-dec="1" data-suf="%">0%</div><div class="k-s"><span class="up" data-kpi="8.2" data-dec="1" data-suf="%">↑ 0%</span> <span class="neu">vs ontem</span></div></div>
        <div class="gw-kpi"><div class="k-l">Ticket médio</div><div class="k-v" data-kpi="86.8" data-dec="2" data-pre="R$ ">R$ 0</div><div class="k-s"><span class="neu">Últimas 24h</span></div></div>
      </div>
      <div class="gw-chart">
        <div class="gw-chart-top">
          <div class="t">Volume de vendas — 30 dias</div>
          <div class="gw-tabs"><button class="gw-tab">7d</button><button class="gw-tab active">30d</button><button class="gw-tab">90d</button></div>
        </div>
        <div class="gw-chart-wrap"><canvas id="${canvasId}" style="width:100%;height:100%"></canvas></div>
        <div class="gw-xlabels"><span>30d</span><span>22d</span><span>15d</span><span>7d</span><span>hoje</span></div>
      </div>
      <div class="gw-foot">
        <div class="gw-fstat"><div class="v">R$ 980</div><div class="l">Menor dia</div></div>
        <div class="gw-fdiv"></div>
        <div class="gw-fstat"><div class="v">R$ 12.847</div><div class="l">Maior dia</div></div>
        <div class="gw-fdiv"></div>
        <div class="gw-fstat"><div class="v">R$ 4.280</div><div class="l">Média</div></div>
        <div class="gw-fdiv"></div>
        <div class="gw-fstat"><div class="v">R$ 128.400</div><div class="l">Total 30d</div></div>
      </div>`;
  }

  function drawChart(canvas, ep) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.offsetWidth, ch = canvas.offsetHeight;
    canvas.width = cw * dpr; canvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const count = Math.max(2, Math.round(ep * 30));
    const data = RAW.slice(0, count);
    const maxVal = Math.max.apply(null, RAW) * 1.08;
    const padT = 6, padB = 2;
    const plotH = ch - padT - padB;
    const pts = data.map((v, i) => ({ x: (i / 29) * cw, y: padT + plotH - (v / maxVal) * plotH }));

    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { const y = padT + (plotH / 3) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke(); }

    const line = (close) => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) { const cpx = (pts[i-1].x + pts[i].x) / 2; ctx.bezierCurveTo(cpx, pts[i-1].y, cpx, pts[i].y, pts[i].x, pts[i].y); }
      if (close) { ctx.lineTo(pts[pts.length-1].x, padT + plotH); ctx.lineTo(pts[0].x, padT + plotH); ctx.closePath(); }
    };
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, 'rgba(167,139,250,0.34)');
    grad.addColorStop(0.7, 'rgba(244,114,182,0.08)');
    grad.addColorStop(1, 'rgba(167,139,250,0)');
    line(true); ctx.fillStyle = grad; ctx.fill();
    line(false); ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();

    const last = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.arc(last.x, last.y, 7, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(167,139,250,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  }

  function animateGateway(root, canvas) {
    const kpis = [].slice.call(root.querySelectorAll('[data-kpi]'));
    let start = null; const dur = 1800;
    function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1); const ep = ease(p);
      drawChart(canvas, ep);
      kpis.forEach((el) => {
        const target = parseFloat(el.dataset.kpi);
        const dec = parseInt(el.dataset.dec || '0', 10);
        const pre = el.dataset.pre || (el.classList.contains('up') ? '↑ ' : '');
        const suf = el.dataset.suf || '';
        const val = target * ep;
        let out = dec ? val.toFixed(dec).replace('.', ',') : fmt(val);
        if (dec && pre.indexOf('R$') > -1) out = val.toFixed(dec).replace('.', ',');
        el.textContent = pre + out + suf;
      });
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function mountGateway(containerId, canvasId) {
    const root = document.getElementById(containerId);
    if (!root) return;
    root.innerHTML = gatewayHTML(canvasId);
    const canvas = document.getElementById(canvasId);
    drawChart(canvas, 0);
    onView(root, () => animateGateway(root, canvas));
    window.addEventListener('resize', () => drawChart(canvas, 1));
  }

  /* ========================================================
     AGENT CHAT (WhatsApp phone)
     ======================================================== */
  const A_MSGS = [
    { id:'m1', side:'r', tag:'ag', label:'Agente IA', type:'text', text:'Boa tarde, Pedro! Tudo certinho? 😊' },
    { id:'m2', side:'l', tag:'cl', label:'Cliente', type:'text', text:'Oi, tudo ótimo!' },
    { id:'m3', side:'r', tag:'ag', label:'Agente IA', type:'text', text:'Aqui é o assistente da ZapLynx.\nVi que você se cadastrou no site, né?' },
    { id:'m4', side:'l', tag:'cl', label:'Cliente', type:'audio', secs:6, bars:[8,12,18,24,20,14,10,16,22,18,12,8,14,20,24,18,12,8,10,16,20,14,8] },
    { id:'m5', side:'r', tag:'ag', label:'Agente IA', type:'audio', secs:5, bars:[10,16,22,18,12,8,14,20,18,12,8,10,16,22,20,14,10,8,12,18,14,10,8] },
    { id:'m6', side:'r', tag:'ag', label:'Agente IA', type:'text', text:'Perfeito! Já te mando o link do checkout 👇' },
    { id:'m7', side:'r', tag:'bt', label:'Checkout', type:'text', text:'🔗 pay.zaplynx.online/curso-completo\n💵 R$ 297,00 — Pix em segundos' },
  ];

  function audioBubble(m) {
    const bars = m.bars.map((h) => `<i style="height:${h}px"></i>`).join('');
    return `<div class="abub-audio"><span class="play"><svg width="11" height="11" viewBox="0 0 12 12" fill="#fff"><polygon points="2,1 11,6 2,11"/></svg></span><span class="wave">${bars}</span><span class="dur">0:0${m.secs}</span></div>`;
  }

  function mountAgent() {
    const root = document.getElementById('agentMock');
    if (!root) return;
    const body = A_MSGS.map((m, i) => {
      const inner = m.type === 'text'
        ? `<div class="bub">${m.text}</div>`
        : audioBubble(m);
      return `<div class="amsg ${m.side}" id="${m.id}"><span class="tag ${m.tag}">${m.label}</span>${inner}<span class="tm">14:${28 + i}</span></div>`;
    }).join('');
    root.innerHTML = `
      <div class="agent-phone">
        <div class="island"></div>
        <div class="agent-screen">
          <div class="agent-top">
            <div class="av"><img src="assets/lynx-logo.png" alt="ZapLynx" /></div>
            <div><div class="nm">ZapLynx IA</div><div class="st">online</div></div>
          </div>
          <div class="agent-body" id="agentBody">
            ${body}
            <div class="atyping" id="agentTyping"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>`;

    const seq = [
      { show:'m1', d:400 }, { typing:1, d:900 }, { typing:0, show:'m2', d:1700 },
      { show:'m3', d:2500 }, { show:'m4', d:3500 }, { typing:1, d:4300 },
      { typing:0, show:'m5', d:5100 }, { show:'m6', d:6100 }, { show:'m7', d:7000 },
    ];
    const body2 = document.getElementById('agentBody');
    const typingEl = document.getElementById('agentTyping');
    let timers = [];
    function run() {
      timers.forEach(clearTimeout); timers = [];
      A_MSGS.forEach((m) => { const el = document.getElementById(m.id); if (el) el.classList.remove('show'); });
      seq.forEach((s) => {
        timers.push(setTimeout(() => {
          if (s.typing !== undefined) typingEl.classList.toggle('show', !!s.typing);
          if (s.show) { const el = document.getElementById(s.show); if (el) el.classList.add('show'); if (body2) body2.scrollTop = body2.scrollHeight; }
        }, s.d));
      });
      timers.push(setTimeout(run, 11000));
    }
    onView(root, () => setTimeout(run, 300));
  }

  /* ========================================================
     INSTAGRAM SCENE
     ======================================================== */
  function mountIG() {
    const root = document.getElementById('igMock');
    if (!root) return;
    root.innerHTML = `
      <div class="ig-post">
        <div class="ig-post-h">
          <div class="ig-av"><div class="in"><img src="assets/ig-avatar.png" alt="ZapLynx" /></div></div>
          <div class="ig-hmeta">
            <div class="ig-uline"><span class="ig-user">zaplynxpro</span><svg class="ig-verified" viewBox="0 0 24 24" aria-label="Verificada"><path fill="#3897f0" d="M12 1.5l2.6 1.9 3.2-.2 1 3 2.7 1.7-1 3 1 3-2.7 1.7-1 3-3.2-.2L12 22.5l-2.6-1.9-3.2.2-1-3L2.5 16l1-3-1-3 2.7-1.7 1-3 3.2.2L12 1.5z"/><path fill="#fff" d="M10.6 14.6l-2.3-2.3 1.1-1.1 1.2 1.2 3.4-3.4 1.1 1.1-4.5 4.5z"/></svg></div>
            <div class="ig-handle">Patrocinado</div>
          </div>
          <button class="ig-more" aria-label="Mais opções"><span></span><span></span><span></span></button>
        </div>
        <div class="ig-img"><img src="assets/ig-feed-funeral.png" alt="ZapLynx enterrando a concorrência" /></div>
        <div class="ig-actions">
          <div class="ig-actions-l">
            <svg viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <svg viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </div>
          <svg class="ig-save" viewBox="0 0 24 24" fill="none" stroke="#262626" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div class="ig-likes"><strong>3.912 curtidas</strong></div>
        <div class="ig-cap"><strong>zaplynxpro</strong> Mais um concorrente enterrado ⚰️ Gateway Pix + WhatsApp + Instagram + IA num só lugar. Comente <strong>"QUERO"</strong> e receba o link pra migrar! <span class="ig-tags">#zaplynx #gatewaypix</span></div>
        <div class="ig-viewall">Ver todos os 428 comentários</div>
        <div class="ig-comments">
          <div class="ig-tc" id="ig-tc">
            <div class="cav" style="background:#c7c7c7"></div>
            <div class="dots"><i></i><i></i><i></i></div>
          </div>
          <div class="ig-c" id="ig-c1"><div class="cav" style="background:linear-gradient(135deg,#833ab4,#cc2366)">M</div><div class="cmain"><div class="ctext"><strong>mari_souza</strong> QUERO! Tô cansada de pagar 4 ferramentas 😮‍💨</div><div class="cmeta"><span>2 h</span><span>22 curtidas</span><span>Responder</span></div></div><svg class="clike" viewBox="0 0 24 24" fill="none" stroke="#8e8e8e" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
          <div class="ig-c" id="ig-c2"><div class="cav" style="background:linear-gradient(135deg,#0095f6,#00c6ff)">J</div><div class="cmain"><div class="ctext"><strong>ju.freitas</strong> QUERO migrar da Kiwify hoje 🙌</div><div class="cmeta"><span>1 h</span><span>15 curtidas</span><span>Responder</span></div></div><svg class="clike" viewBox="0 0 24 24" fill="none" stroke="#8e8e8e" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
          <div class="ig-c" id="ig-c3"><div class="cav" style="background:linear-gradient(135deg,#e1306c,#fd1d1d)">A</div><div class="cmain"><div class="ctext"><strong>ana_vf</strong> O Pix cai na hora mesmo? QUERO testar 💜</div><div class="cmeta"><span>47 min</span><span>9 curtidas</span><span>Responder</span></div></div><svg class="clike" viewBox="0 0 24 24" fill="none" stroke="#8e8e8e" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
          <div class="ig-c" id="ig-c4"><div class="cav" style="background:linear-gradient(135deg,#fcb045,#fd1d1d)">P</div><div class="cmain"><div class="ctext"><strong>pedra.lima</strong> QUERO!! Agente de IA vendendo sozinho 🔥</div><div class="cmeta"><span>12 min</span><span>Responder</span></div></div><svg class="clike" viewBox="0 0 24 24" fill="none" stroke="#8e8e8e" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
        </div>
        <div class="ig-addc"><div class="ig-addc-av"></div><span>Adicione um comentário...</span></div>
      </div>
      <div class="ig-flow">
        <div class="ig-nb" id="ig-nb"><span class="d"></span>IA detectou</div>
        <div class="ig-aic" id="ig-ai"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div>
        <div class="ig-line"><div class="fill" id="ig-af"></div></div>
        <div class="ig-label" id="ig-al">DM automático</div>
      </div>
      <div class="ig-dm">
        <div class="ig-dm-h"><div class="ig-dm-av">M</div><div><div class="ig-dm-u">mari_souza</div><div class="ig-dm-s">Instagram Direct</div></div><div class="ig-dm-on"></div></div>
        <div class="ig-dm-body">
          <div class="dm recv" id="ig-d0"><div class="b">Oi! Comentei QUERO no post 👀 É verdade que junta tudo numa só?</div><div class="tm">agora</div></div>
          <div class="ig-dm-typing" id="ig-dtyp"><div class="dots"><i></i><i></i><i></i></div></div>
          <div class="dm sent" id="ig-d1"><div class="b">Oi, Mari! 👋 É sim: Gateway Pix + WhatsApp + Instagram + IA num painel só 🚀</div><div class="tm">ZapLynx IA</div></div>
          <div class="dm sent" id="ig-d2"><div class="b">⚡ <strong>Migre pra ZapLynx</strong><br>💵 2 dias grátis, sem cartão<br>🔗 zaplynx.com/migrar</div><div class="tm">ZapLynx IA</div></div>
          <div class="dm sent" id="ig-d3"><div class="b">A gente cuida da migração pra você 😉</div><div class="tm">ZapLynx IA</div></div>
          <div class="dm recv" id="ig-d4"><div class="b">Fechou! Vou testar agora 💜💜</div><div class="tm">agora</div></div>
        </div>
        <div class="ig-dm-input"><input placeholder="Mensagem..." readonly /><button class="snd"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>
      </div>`;

    const IDS = ['ig-tc','ig-nb','ig-ai','ig-al','ig-c1','ig-c2','ig-c3','ig-c4','ig-d0','ig-d1','ig-d2','ig-d3','ig-d4','ig-dtyp'];
    const show = (id, t, tm) => tm.push(setTimeout(() => { const el = document.getElementById(id); if (el) el.classList.add('show'); }, t));
    const hide = (id, t, tm) => tm.push(setTimeout(() => { const el = document.getElementById(id); if (el) el.classList.remove('show'); }, t));
    let timers = [];
    function run() {
      timers.forEach(clearTimeout); timers = [];
      IDS.forEach((id) => { const el = document.getElementById(id); if (el) el.classList.remove('show'); });
      const af = document.getElementById('ig-af'); if (af) af.style.height = '0%';
      show('ig-tc', 400, timers); hide('ig-tc', 1200, timers);
      show('ig-c1', 1300, timers); show('ig-c2', 1900, timers); show('ig-c3', 2500, timers); show('ig-c4', 3100, timers);
      show('ig-nb', 3500, timers); show('ig-ai', 3900, timers);
      timers.push(setTimeout(() => { const a = document.getElementById('ig-af'); if (a) a.style.height = '100%'; }, 4300));
      show('ig-al', 5000, timers);
      show('ig-d0', 5300, timers); show('ig-dtyp', 5900, timers); hide('ig-dtyp', 6900, timers);
      show('ig-d1', 7000, timers); show('ig-d2', 7700, timers); show('ig-d3', 8400, timers); show('ig-d4', 9300, timers);
      timers.push(setTimeout(run, 13000));
    }
    onView(root, () => setTimeout(run, 400));
  }

  /* ========================================================
     PAC-MAN HERO STRIP
     ======================================================== */
  function mountPacman() {
    const canvas = document.getElementById('pacman-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const names = ['kiwify','hotmart','devzapp','sendflow','manychat'];
    const exts = { kiwify:'jpg', hotmart:'jpg', devzapp:'jpg', sendflow:'png', manychat:'webp' };
    const labels = { kiwify:'Kiwify', hotmart:'Hotmart', devzapp:'DevZapp', sendflow:'SendFlow', manychat:'ManyChat' };
    const imgs = {};
    names.forEach((n) => { const im = new Image(); im.src = `assets/competitors/${n}.${exts[n]}`; imgs[n] = im; });

    let W = 0, H = 0;
    function resize() {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    let objs = [], pacX = 0, pacY = 0, pacAngle = 0, mouth = 0.25, mdir = 1, target = 0, phase = 'eat', raf;
    const R = 22;
    function init() {
      pacX = -40; pacY = H / 2;
      const spacing = (W * 0.74) / names.length;
      objs = names.map((n, i) => ({ n, x: W * 0.22 + i * spacing, y: H / 2 + Math.sin(i * 1.3) * 14, eaten: false, op: 1, sc: 1 }));
      target = 0; phase = 'eat';
    }
    init();

    function drawLogo(o) {
      const r = R;
      ctx.save(); ctx.globalAlpha = o.op;
      ctx.translate(o.x, o.y); ctx.scale(o.sc, o.sc); ctx.translate(-o.x, -o.y);
      ctx.save(); ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.clip();
      const im = imgs[o.n];
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, o.x - r, o.y - r, r * 2, r * 2);
      else { ctx.fillStyle = '#333'; ctx.fillRect(o.x - r, o.y - r, r * 2, r * 2); }
      ctx.restore();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    function drawPac() {
      ctx.save(); ctx.translate(pacX, pacY); ctx.rotate(pacAngle);
      ctx.shadowColor = 'rgba(245,197,24,0.7)'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R + 4, mouth * Math.PI, (2 - mouth) * Math.PI); ctx.closePath();
      ctx.fillStyle = '#f5c518'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc((R + 4) * 0.18, -(R + 4) * 0.4, (R + 4) * 0.1, 0, Math.PI * 2); ctx.fillStyle = '#0d0f1a'; ctx.fill();
      ctx.restore();
    }
    function dots() {
      ctx.fillStyle = 'rgba(167,139,250,0.28)';
      for (let i = 0; i < 14; i++) {
        const px = W * 0.06 + i * (W * 0.066);
        if (px < pacX - 20) continue;
        let skip = false; objs.forEach((o) => { if (Math.abs(px - o.x) < 22 && o.eaten) skip = true; });
        if (skip) continue;
        ctx.beginPath(); ctx.arc(px, H / 2, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    function update() {
      if (phase === 'eat') {
        const t = objs[target];
        if (!t) { phase = 'exit'; return; }
        const dx = t.x - pacX, dy = t.y - pacY, dist = Math.hypot(dx, dy);
        pacAngle = Math.atan2(dy, dx);
        if (dist > R + 12) { pacX += (dx / dist) * 2.4; pacY += (dy / dist) * 2.4; }
        else { t.sc = Math.max(0, t.sc - 0.09); t.op = Math.max(0, t.op - 0.09); if (t.op <= 0) { t.eaten = true; target++; updateScore(); } }
      } else {
        pacX += 2.6; pacAngle = 0;
        if (pacX > W + 50) init();
      }
      mouth += 0.045 * mdir; if (mouth > 0.28 || mouth < 0.03) mdir *= -1;
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      dots();
      objs.forEach((o) => { if (!(o.eaten && o.op <= 0)) drawLogo(o); });
      drawPac();
    }
    const scoreEl = document.getElementById('pacScore');
    const defScore = scoreEl ? scoreEl.textContent : '';
    function updateScore() {
      const eaten = objs.filter((o) => o.eaten).length;
      if (!scoreEl) return;
      if (eaten === 0) scoreEl.textContent = defScore;
      else scoreEl.textContent = `+${eaten} concorrente${eaten > 1 ? 's' : ''} engolido${eaten > 1 ? 's' : ''}`;
    }
    function loop() { update(); draw(); raf = requestAnimationFrame(loop); }
    loop();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); init(); loop(); });
  }

  /* ========================================================
     ANIMATED FLOW EDITOR
     ======================================================== */
  function mountFlow() {
    const stage = document.getElementById('flowMock');
    if (!stage) return;

    const icon = {
      bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>',
      branch: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M6 9v6M9 6h6"/>',
      chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.6 13H19l2-9H6"/>'
    };

    stage.innerHTML = `
      <svg class="flow-edges" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#7c3aed"/><stop offset="0.5" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/>
          </linearGradient>
        </defs>
      </svg>
      <div class="fnode" id="fn1" style="left:4%;top:50%">
        <div class="fn-h"><span class="fn-ic green"><svg viewBox="0 0 24 24">${icon.chat}</svg></span><span class="fn-t">Gatilho</span></div>
        <div class="fn-sub">Mensagem no WhatsApp</div><span class="fn-tag green">Palavra "QUERO"</span>
      </div>
      <div class="fnode" id="fn2" style="left:37%;top:50%">
        <div class="fn-h"><span class="fn-ic violet"><svg viewBox="0 0 24 24">${icon.branch}</svg></span><span class="fn-t">Condição</span></div>
        <div class="fn-sub">É um cliente novo?</div>
      </div>
      <div class="fnode" id="fn3" style="left:69%;top:24%">
        <div class="fn-h"><span class="fn-ic blue"><svg viewBox="0 0 24 24">${icon.chat}</svg></span><span class="fn-t">Mensagem</span></div>
        <div class="fn-sub">Resposta automática</div><span class="fn-tag blue">Sim</span>
      </div>
      <div class="fnode" id="fn4" style="left:69%;top:76%">
        <div class="fn-h"><span class="fn-ic amber"><svg viewBox="0 0 24 24">${icon.cart}</svg></span><span class="fn-t">Ação</span></div>
        <div class="fn-sub">Enviar link de checkout</div><span class="fn-tag">Vender</span>
      </div>`;

    const svg = stage.querySelector('svg.flow-edges');
    const NS = 'http://www.w3.org/2000/svg';
    const nodes = { 1: stage.querySelector('#fn1'), 2: stage.querySelector('#fn2'), 3: stage.querySelector('#fn3'), 4: stage.querySelector('#fn4') };

    const edgeDefs = [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 2, to: 4 }];
    const edges = edgeDefs.map(() => {
      const base = document.createElementNS(NS, 'path'); base.setAttribute('class', 'base');
      const glow = document.createElementNS(NS, 'path'); glow.setAttribute('class', 'glow');
      const dot = document.createElementNS(NS, 'circle'); dot.setAttribute('class', 'dot'); dot.setAttribute('r', '4');
      svg.appendChild(base); svg.appendChild(glow); svg.appendChild(dot);
      return { base, glow, dot, len: 0 };
    });

    function anchor(node, side) {
      const sr = stage.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      const y = r.top - sr.top + r.height / 2;
      const x = side === 'right' ? (r.right - sr.left) : (r.left - sr.left);
      return { x, y };
    }
    function layout() {
      const w = stage.clientWidth, h = stage.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      edgeDefs.forEach((def, i) => {
        const a = anchor(nodes[def.from], 'right');
        const b = anchor(nodes[def.to], 'left');
        const dx = (b.x - a.x);
        const d = `M ${a.x} ${a.y} C ${a.x + dx * 0.5} ${a.y}, ${b.x - dx * 0.5} ${b.y}, ${b.x} ${b.y}`;
        edges[i].base.setAttribute('d', d);
        edges[i].glow.setAttribute('d', d);
        const len = edges[i].glow.getTotalLength();
        edges[i].len = len;
        edges[i].glow.style.strokeDasharray = len;
        if (!edges[i]._active) edges[i].glow.style.strokeDashoffset = len;
      });
    }

    function resetAll() {
      Object.values(nodes).forEach((n) => n.classList.remove('on'));
      edges.forEach((e) => { e._active = false; e.glow.style.transition = 'none'; e.glow.style.strokeDashoffset = e.len; e.dot.style.opacity = '0'; });
    }
    function activate(id) { nodes[id].classList.add('on'); }

    function drawEdge(e, dur, cb) {
      e._active = true; e.glow.style.transition = 'none';
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const t = Math.min((ts - start) / dur, 1);
        const len = e.len;
        e.glow.style.strokeDashoffset = len * (1 - t);
        try { const pt = e.glow.getPointAtLength(len * t); e.dot.setAttribute('cx', pt.x); e.dot.setAttribute('cy', pt.y); e.dot.style.opacity = '1'; } catch (err) {}
        if (t < 1) requestAnimationFrame(step);
        else { e.dot.style.opacity = '0'; if (cb) cb(); }
      }
      requestAnimationFrame(step);
    }

    let timers = [];
    function run() {
      timers.forEach(clearTimeout); timers = [];
      layout(); resetAll();
      timers.push(setTimeout(() => activate(1), 250));
      timers.push(setTimeout(() => drawEdge(edges[0], 650, () => activate(2)), 700));
      timers.push(setTimeout(() => {
        drawEdge(edges[1], 760, () => activate(3));
        drawEdge(edges[2], 760, () => activate(4));
      }, 1600));
      timers.push(setTimeout(run, 4300));
    }

    layout();
    if ('ResizeObserver' in window) { const rZ = new ResizeObserver(() => layout()); rZ.observe(stage); }
    window.addEventListener('resize', layout);
    onView(stage, () => setTimeout(run, 300), 0.25);
  }

  /* ======================================================== */
  function boot() {
    mountGateway('heroPanel', 'heroChart');
    mountGateway('gwMock', 'gwChart');
    mountAgent();
    mountIG();
    mountFlow();
    mountPacman();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
