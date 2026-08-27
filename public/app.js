const app=document.querySelector('#app');
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(c)||0)/100);
const today=()=>new Date().toISOString().slice(0,10);
const currentMonth=()=>new Date().toISOString().slice(0,7);
const monthLabel=v=>{if(!v)return'';const [y,m]=v.split('-');return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const amountValue=c=>((Number(c)||0)/100).toFixed(2);
const statusLabel=s=>({pendente:'Pendente',pago:'Pago',recebido:'Recebido',atrasado:'Atrasado'}[s]||'Pago');
const accountTypeLabel=s=>({carteira:'Carteira',conta_corrente:'Conta corrente',poupanca:'Poupança',cartao:'Cartão',dinheiro:'Dinheiro',investimento:'Investimento'}[s]||'Carteira');
const apiUrl=path=>(location.protocol==='file:'||location.protocol==='app:')?`https://financeiro-eduardo.construtec-reports.workers.dev${path}`:path;
let token=localStorage.getItem('financeiro_token')||'';
let state={user:null,categories:[],accounts:[],transactions:[],dashboard:null,month:currentMonth(),filters:{type:'',category_id:'',status:'',q:''}, history:[], dashboard:{budgets:[],expenses_by_category:[]}};

async function api(path,opts={}){
  const headers={'content-type':'application/json',...(opts.headers||{})};
  if(token)headers.authorization=`Bearer ${token}`;
  const r=await fetch(apiUrl(path),{...opts,headers});
  if(r.status===401&&token){localStorage.removeItem('financeiro_token');token='';renderLogin();throw new Error('Sessão expirada.');}
  const ct=r.headers.get('content-type')||'';
  const data=ct.includes('application/json')?await r.json():await r.text();
  if(!r.ok)throw new Error(data?.error||'Erro na operação.');
  return data;
}

function icon(type){
  const icons={wallet:'R$',up:'↑',down:'↓',trend:'↗',plus:'+',home:'⌂',list:'≡',chart:'◫',export:'⇩',logout:'↪'};
  return `<span class="ui-icon">${icons[type]||''}</span>`;
}

function ensureToastContainer(){if(!document.querySelector('.toast-container')){document.body.insertAdjacentHTML('beforeend','<div class="toast-container"></div>');} return document.querySelector('.toast-container');}
function toast(msg,type='success',duration=3000){const c=ensureToastContainer();const icons={success:'✓',error:'✗',info:'ℹ'};const el=document.createElement('div');el.className=`toast ${type}`;el.innerHTML=`<span class="toast-icon">${icons[type]||'ℹ'}</span><span class="toast-msg">${esc(msg)}</span><button class="toast-close">×</button>`;c.appendChild(el);el.querySelector('.toast-close').onclick=()=>{el.style.animation='toastOut .3s ease forwards';setTimeout(()=>el.remove(),300);};setTimeout(()=>{if(el.parentNode){el.style.animation='toastOut .3s ease forwards';setTimeout(()=>el.remove(),300);}},duration);}
function confirmDialog(msg){return new Promise(resolve=>{document.body.insertAdjacentHTML('beforeend',`<div class="confirm-overlay"><div class="confirm-card"><h3>Confirmação</h3><p>${esc(msg)}</p><div class="confirm-actions"><button class="btn secondary" id="confirmNo">Cancelar</button><button class="btn primary" id="confirmYes">Confirmar</button></div></div></div>`);const overlay=document.querySelector('.confirm-overlay');document.querySelector('#confirmNo').onclick=()=>{overlay.remove();resolve(false);};document.querySelector('#confirmYes').onclick=()=>{overlay.remove();resolve(true);};overlay.onclick=e=>{if(e.target===overlay){overlay.remove();resolve(false);}};});}


let authMode = 'login';

function loginTemplate(mode = 'login') {
  const isLogin = mode === 'login';
  return `<main class="auth-page">
    <section class="auth-hero">
      <div class="auth-brand"><div class="brand-mark">R$</div><span>Financeiro Eduardo</span></div>
      <div class="auth-copy">
        <span class="eyebrow">CONTROLE FINANCEIRO</span>
        <h1>Seu dinheiro,<br><strong>mais organizado.</strong></h1>
        <p>Acompanhe entradas, saídas e seu saldo em um só lugar, de forma simples e visual.</p>
        <div class="auth-points"><span>✓ Visão mensal</span><span>✓ Categorias</span><span>✓ Histórico completo</span></div>
      </div>
      <div class="auth-orb orb-one"></div><div class="auth-orb orb-two"></div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <div class="mobile-brand"><div class="brand-mark">R$</div><span>Financeiro Eduardo</span></div>
        <span class="eyebrow">${isLogin ? 'BEM-VINDO DE VOLTA' : 'NOVA CONTA'}</span>
        <h2>${isLogin ? 'Entre na sua conta' : 'Crie sua conta'}</h2>
        <p>${isLogin ? 'Informe seus dados para acessar o painel.' : 'Preencha os campos abaixo para cadastrar seu acesso.'}</p>
        <form id="authForm" class="auth-form">
          ${isLogin ? '' : `<label>Nome completo<input name="name" autocomplete="name" placeholder="Digite seu nome" required></label>`}
          <label>E-mail<input name="email" type="email" autocomplete="email" placeholder="seuemail@exemplo.com" required></label>
          <label>Senha<input name="password" type="password" minlength="8" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="Mínimo de 8 caracteres" required></label>
          <button class="btn primary auth-submit" type="submit">${isLogin ? 'Entrar no painel' : 'Criar minha conta'} <span>→</span></button>
          <div id="authError" class="error"></div>
        </form>
        <div class="auth-toggle">
          ${isLogin ? 
            `<span>Não tem uma conta?</span> <button type="button" id="toggleAuthMode" class="btn-link">Criar conta</button>` : 
            `<span>Já tem uma conta?</span> <button type="button" id="toggleAuthMode" class="btn-link">Entrar</button>`
          }
        </div>
      </div>
    </section>
  </main>`;
}

async function renderLogin(targetMode){
  if(targetMode) authMode = targetMode;
  const s = await api('/api/setup/status').catch(()=>({configured:false}));
  if(!s.configured && !targetMode) authMode = 'register';

  app.innerHTML = loginTemplate(authMode);

  const toggleBtn = document.querySelector('#toggleAuthMode');
  if(toggleBtn){
    toggleBtn.onclick = () => renderLogin(authMode === 'login' ? 'register' : 'login');
  }

  document.querySelector('#authForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const err = document.querySelector('#authError');
    const btn = e.currentTarget.querySelector('button[type="submit"]');
    err.textContent = ''; btn.disabled = true; btn.classList.add('loading');
    try {
      if (authMode === 'register') {
        if (!s.configured) {
          await api('/api/setup', { method: 'POST', body: JSON.stringify(payload) });
        } else {
          await api('/api/register', { method: 'POST', body: JSON.stringify(payload) });
        }
        toast('Conta criada com sucesso!', 'success');
      }
      const res = await api('/api/login', { method: 'POST', body: JSON.stringify(payload) });
      token = res.token;
      localStorage.setItem('financeiro_token', token);
      await boot();
    } catch(ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.classList.remove('loading');
    }
  };
}

async function load(){
  const qs=new URLSearchParams({month:state.month});
  if(state.filters.type)qs.set('type',state.filters.type);
  if(state.filters.category_id)qs.set('category_id',state.filters.category_id);
  if(state.filters.status)qs.set('status',state.filters.status);
  if(state.filters.q)qs.set('q',state.filters.q);
  const [me,cats,tx,dash,hist]=await Promise.all([
    api('/api/me'),api('/api/categories'),api(`/api/transactions?${qs}`),api(`/api/dashboard?month=${state.month}`),api('/api/dashboard/history?months=6')
  ]);
  state.user=me.user;state.categories=cats.items;state.accounts=dash.accounts||[];state.transactions=tx.items;state.dashboard=dash;state.history=hist.items||[];
}

function kpisHtml(){
  const d=state.dashboard||{};
  return `<div class="kpi-grid">
    <article class="kpi-card balance-card"><div class="kpi-top"><span class="kpi-icon wallet">${icon('wallet')}</span><span>Saldo acumulado</span></div><strong>${money(d.saldo_total_cents)}</strong><small>Patrimônio registrado</small></article>
    <article class="kpi-card"><div class="kpi-top"><span class="kpi-icon income">${icon('up')}</span><span>Entradas</span></div><strong class="positive">${money(d.entradas_cents)}</strong><small>${monthLabel(state.month)}</small></article>
    <article class="kpi-card"><div class="kpi-top"><span class="kpi-icon expense">${icon('down')}</span><span>Saídas</span></div><strong class="negative">${money(d.saidas_cents)}</strong><small>${monthLabel(state.month)}</small></article>
    <article class="kpi-card"><div class="kpi-top"><span class="kpi-icon result">${icon('trend')}</span><span>Resultado do mês</span></div><strong class="${(d.saldo_mes_cents||0)>=0?'positive':'negative'}">${money(d.saldo_mes_cents)}</strong><small>${(d.saldo_mes_cents||0)>=0?'Saldo positivo no período':'Atenção aos gastos do período'}</small></article>
  </div>`;
}

function transactionsHtml(){
  if(!state.transactions.length)return `<div class="empty-state"><div class="empty-icon">↕</div><h3>Nenhuma movimentação</h3><p>Você ainda não registrou lançamentos em ${monthLabel(state.month)}.</p><button class="btn primary" data-open-new>+ Adicionar lançamento</button></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th>Tipo</th><th>Status</th><th class="value-col">Valor</th><th></th></tr></thead><tbody>${state.transactions.map(t=>`<tr>
    <td><div class="tx-main"><span class="tx-symbol ${t.type}">${t.type==='entrada'?'↑':'↓'}</span><div><strong>${esc(t.description)}</strong><small>${esc(t.account_name||'Sem conta')} • ${esc(t.payment_method||'Não informado')} • ${Number(t.installment_count||1)>1?`Parcela ${esc(t.installment_number)}/${esc(t.installment_count)}`:(t.recurring_type==='mensal'?'Mensal':'Único')}</small></div></div></td>
    <td><span class="category-pill">${esc((t.category_icon||'')+' '+(t.category_name||'Sem categoria'))}</span></td>
    <td>${esc(t.transaction_date.split('-').reverse().join('/'))}</td>
    <td><span class="badge ${t.type==='entrada'?'in':'out'}">${t.type==='entrada'?'Entrada':'Saída'}</span></td>
    <td><span class="badge status-${esc(t.status||'pago')}">${statusLabel(t.status)}</span></td>
    <td class="value-col ${t.type==='entrada'?'positive':'negative'}">${t.type==='entrada'?'+':'-'} ${money(t.amount_cents)}</td>
    <td><button class="icon-btn" title="Detalhes" data-detail="${t.id}">ⓘ</button><button class="icon-btn" title="Editar" data-edit="${t.id}">✎</button><button class="icon-btn" title="Excluir" data-delete="${t.id}">×</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function accountsHtml(){
  const items=state.accounts||[];
  if(!items.length)return `<div class="mini-empty"><span>◌</span><p>Nenhuma conta cadastrada.</p></div>`;
  return `<div class="category-list">${items.map(a=>`<div class="category-row"><div class="category-title"><span class="category-avatar">R$</span><div><strong>${esc(a.name)}</strong><small>${accountTypeLabel(a.type)}</small></div></div><div class="category-amount"><strong>${money(a.balance_cents)}</strong><button class="link-btn" data-account-edit="${a.id}">Editar</button></div></div>`).join('')}</div>`;
}

function categoriesHtml(){
  const items=state.dashboard?.expenses_by_category||[];
  const manage=state.categories.length?`<div class="category-manage">${state.categories.map(c=>`<button class="category-edit" data-category-edit="${c.id}">${esc((c.icon||'')+' '+c.name)}</button>`).join('')}</div>`:'';
  if(!items.length)return `<div class="mini-empty"><span>◌</span><p>Sem despesas por categoria neste mês.</p></div>${manage}`;
  const total=items.reduce((a,b)=>a+Number(b.total_cents||0),0);
  return `<div class="category-list">${items.map((x,i)=>{const pct=total?Math.round(Number(x.total_cents||0)/total*100):0;return `<div class="category-row">
    <div class="category-title"><span class="category-avatar tone-${i%5}">${esc(x.icon||'•')}</span><div><strong>${esc(x.name)}</strong><small>${pct}% das despesas</small></div></div>
    <div class="category-amount"><strong>${money(x.total_cents)}</strong><div class="progress"><span style="width:${Math.max(4,pct)}%"></span></div></div>
  </div>`;}).join('')}</div>${manage}`;
}

function overviewHtml(){
  const d=state.dashboard||{};
  const income=Number(d.entradas_cents||0), expense=Number(d.saidas_cents||0), max=Math.max(income,expense,1);
  const incomePct=Math.round(income/max*100), expensePct=Math.round(expense/max*100);
  return `<div class="overview-chart">
    <div class="chart-head"><div><span class="eyebrow">FLUXO DO MÊS</span><h3>Entradas x saídas</h3></div><span class="period-chip">${monthLabel(state.month)}</span></div>
    <div class="bar-group"><div class="bar-line"><div><span class="dot income-dot"></span>Entradas</div><strong>${money(income)}</strong></div><div class="bar-track"><span class="income-bar" style="width:${incomePct}%"></span></div></div>
    <div class="bar-group"><div class="bar-line"><div><span class="dot expense-dot"></span>Saídas</div><strong>${money(expense)}</strong></div><div class="bar-track"><span class="expense-bar" style="width:${expensePct}%"></span></div></div>
    <div class="chart-footer"><span>Resultado</span><strong class="${(d.saldo_mes_cents||0)>=0?'positive':'negative'}">${money(d.saldo_mes_cents)}</strong></div>
  </div>`;
}

function historyChartHtml(history){
  if(!history||!history.length)return '';
  const max=Math.max(...history.map(h=>Math.max(h.entradas_cents,h.saidas_cents)),1);
  const monthShort=v=>{if(!v)return'';const [y,m]=v.split('-');return new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(Number(y),Number(m)-1,1));};
  return `<div class="history-chart"><div class="chart-head"><div><span class="eyebrow">EVOLUÇÃO</span><h3>Últimos ${history.length} meses</h3></div></div><div class="history-bars">${history.map(h=>{const inH=Math.max(4,Math.round(h.entradas_cents/max*160));const outH=Math.max(4,Math.round(h.saidas_cents/max*160));return `<div class="history-bar-group"><div class="history-bar-pair"><div class="history-bar income" style="height:${inH}px" title="Entradas: ${money(h.entradas_cents)}"></div><div class="history-bar expense" style="height:${outH}px" title="Saídas: ${money(h.saidas_cents)}"></div></div><span class="history-bar-label">${monthShort(h.month)}</span></div>`;}).join('')}</div><div class="history-legend"><span><span class="dot income-dot" style="background:#22c55e"></span>Entradas</span><span><span class="dot expense-dot" style="background:#ef4444"></span>Saídas</span></div></div>`;
}
function budgetHtml(){
  const budgets=state.dashboard?.budgets||[];const expenses=state.dashboard?.expenses_by_category||[];
  if(!budgets.length)return `<div class="mini-empty"><span>🎯</span><p>Nenhum orçamento definido para ${monthLabel(state.month)}.</p></div>`;
  return `<div class="budget-list">${budgets.map(b=>{const catExpense=expenses.find(e=>e.name===(b.category_name||'Sem categoria'));const spent=catExpense?Number(catExpense.total_cents||0):0;const limit=Number(b.limit_cents||0);const pct=limit?Math.round(spent/limit*100):0;const barClass=pct>=100?'over':pct>=75?'warn':'under';return `<div class="budget-row"><div class="budget-info"><strong>${esc((b.category_icon||'📁')+' '+(b.category_name||'Geral'))}</strong><div class="budget-progress"><span class="${barClass}" style="width:${Math.min(100,pct)}%"></span></div><small>${pct}% utilizado</small></div><div class="budget-values"><strong>${money(spent)}</strong><small>de ${money(limit)}</small></div></div>`;}).join('')}</div>`;
}
function printReport(){
  const d=state.dashboard||{};const txs=state.transactions||[];
  const html=`<div class="print-overlay" id="printOverlay"><div class="print-actions"><button class="btn primary" onclick="window.print()">🖨️ Imprimir</button><button class="btn secondary" onclick="document.querySelector('#printOverlay').remove()">✕ Fechar</button></div><div class="print-header"><h1>Financeiro Eduardo</h1><p>Relatório de ${monthLabel(state.month)}</p></div><div class="print-kpis"><div class="print-kpi"><strong>${money(d.entradas_cents)}</strong><small>Entradas</small></div><div class="print-kpi"><strong>${money(d.saidas_cents)}</strong><small>Saídas</small></div><div class="print-kpi"><strong>${money(d.saldo_mes_cents)}</strong><small>Resultado</small></div><div class="print-kpi"><strong>${money(d.saldo_total_cents)}</strong><small>Saldo total</small></div></div><table><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Status</th><th>Valor</th></tr></thead><tbody>${txs.map(t=>`<tr><td>${esc(t.transaction_date.split('-').reverse().join('/'))}</td><td>${esc(t.description)}</td><td>${t.type==='entrada'?'Entrada':'Saída'}</td><td>${esc(t.category_name||'Sem categoria')}</td><td>${statusLabel(t.status)}</td><td style="text-align:right">${t.type==='entrada'?'+':'-'} ${money(t.amount_cents)}</td></tr>`).join('')}</tbody></table></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openBudgetModal(){
  const options=state.categories.filter(c=>c.type==='saida'||c.type==='ambos').map(c=>`<option value="${c.id}">${esc((c.icon||'')+' '+c.name)}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend',`<div id="budgetModal" class="modal"><div class="modal-card"><div class="modal-head"><div><span class="eyebrow">ORÇAMENTO</span><h2>Definir orçamento mensal</h2><p>Defina um limite de gasto por categoria para ${monthLabel(state.month)}.</p></div><button class="modal-close" id="closeBudget">×</button></div><form id="budgetForm" class="form"><input type="hidden" name="month" value="${state.month}"><label class="field"><span>Categoria</span><select name="category_id"><option value="">Geral (todas)</option>${options}</select></label><label class="field"><span>Limite mensal</span><div class="money-input"><b>R$</b><input name="limit" type="number" min="0.01" step="0.01" placeholder="0,00" required></div></label><div id="budgetError" class="error full"></div><div class="modal-actions full"><button class="btn secondary" type="button" id="cancelBudget">Cancelar</button><button class="btn primary" type="submit">Salvar orçamento</button></div></form></div></div>`);
  const modal=document.querySelector('#budgetModal');const close=()=>modal.remove();document.querySelector('#closeBudget').onclick=close;document.querySelector('#cancelBudget').onclick=close;
  document.querySelector('#budgetForm').onsubmit=async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api('/api/budgets',{method:'POST',body:JSON.stringify(payload)});close();toast('Orçamento salvo!','success');await refresh();}catch(ex){document.querySelector('#budgetError').textContent=ex.message;}};
}


function renderApp(){
  const categoryFilterOptions=state.categories.map(c=>`<option value="${c.id}" ${state.filters.category_id===c.id?'selected':''}>${esc((c.icon||'')+' '+c.name)}</option>`).join('');
  app.innerHTML=`<div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="brand-mark">R$</div><div><strong>Financeiro</strong><span>Eduardo</span></div></div>
      <nav class="sidebar-nav">
        <button class="nav-item active" id="navHome">${icon('home')}<span>Visão geral</span></button>
        <button class="nav-item" id="navTransactions">${icon('list')}<span>Movimentações</span></button>
        <button class="nav-item" id="navCategories">${icon('chart')}<span>Categorias</span></button>
        <button class="nav-item" id="navSettings"><span class="ui-icon">⚙</span><span>Configurações</span></button>
      </nav>
      <div class="sidebar-foot">
        <div class="user-avatar">${esc((state.user?.name||'E').trim().charAt(0).toUpperCase())}</div>
        <div class="user-meta"><strong>${esc(state.user?.name||'Eduardo')}</strong><span>${esc(state.user?.email||'')}</span></div>
        <button id="logoutBtn" class="logout-icon" title="Sair">${icon('logout')}</button>
      </div>
    </aside>
    <main class="main-content">
      <header class="page-header">
        <div><span class="eyebrow">PAINEL FINANCEIRO</span><h1>Olá, ${esc((state.user?.name||'Eduardo').split(' ')[0])} 👋</h1><p>Acompanhe seu dinheiro e mantenha tudo sob controle.</p></div>
        <div class="header-actions"><input id="month" class="month-input" type="month" value="${state.month}"><button id="newBtn" class="btn primary">${icon('plus')} Novo lançamento</button></div>
      </header>
      ${kpisHtml()}
      <section class="dashboard-grid">
        <article class="panel">${overviewHtml()}</article>
            <article class="panel">${historyChartHtml(state.history)}</article>
        <article class="panel"><div class="panel-head"><h2>Metas e Orçamento</h2><button class="btn secondary" id="setBudgetBtn">+ Definir</button></div>${budgetHtml()}</article>
        <article class="panel" id="categoriesSection"><div class="panel-head"><div><span class="eyebrow">DESPESAS</span><h2>Por categoria</h2></div><button id="newCategoryBtn" class="btn secondary">+ Categoria</button></div>${categoriesHtml()}</article>
      </section>
      <section class="dashboard-grid">
        <article class="panel" id="accountsSection"><div class="panel-head"><div><span class="eyebrow">CARTEIRAS</span><h2>Contas</h2></div><div class="panel-actions"><button id="transferBtn" class="btn secondary">Transferir</button><button id="newAccountBtn" class="btn secondary">+ Conta</button></div></div>${accountsHtml()}</article>
      </section>
      <section class="panel transactions-panel" id="transactionsSection">
        <div class="panel-head"><div><span class="eyebrow">HISTÓRICO</span><h2>Movimentações</h2></div><div class="panel-actions"><span class="record-count">${state.transactions.length} ${state.transactions.length===1?'lançamento':'lançamentos'}</span><button id="exportBtn" class="btn secondary">${icon('export')} Exportar CSV</button>
              <button id="printBtn" class="btn secondary">🖨️ Imprimir</button></div></div>
        <div class="filter-bar"><input id="filterSearch" placeholder="Pesquisar" value="${esc(state.filters.q)}"><select id="filterType"><option value="">Todos os tipos</option><option value="entrada" ${state.filters.type==='entrada'?'selected':''}>Entradas</option><option value="saida" ${state.filters.type==='saida'?'selected':''}>Saídas</option></select><select id="filterCategory"><option value="">Todas as categorias</option>${categoryFilterOptions}</select><select id="filterStatus"><option value="">Todos os status</option><option value="pendente" ${state.filters.status==='pendente'?'selected':''}>Pendente</option><option value="pago" ${state.filters.status==='pago'?'selected':''}>Pago</option><option value="recebido" ${state.filters.status==='recebido'?'selected':''}>Recebido</option><option value="atrasado" ${state.filters.status==='atrasado'?'selected':''}>Atrasado</option></select></div>
        ${transactionsHtml()}
      </section>
      <section id="servicesPage" class="services-page"></section>
    
        <section id="settingsPage" class="settings-page">
          <header class="page-header"><div><span class="eyebrow">SISTEMA</span><h1>Configurações</h1><p>Backup, restauração e preferências.</p></div></header>
          <div class="settings-card"><h3>💾 Backup dos dados</h3><p>Exporte todos os seus dados em formato JSON para manter um backup seguro.</p><div class="settings-actions"><button id="backupBtn" class="btn primary">Baixar backup</button></div></div>
          <div class="settings-card"><h3>📥 Restaurar dados</h3><p>Importe um backup JSON gerado anteriormente. Os dados importados serão adicionados ao sistema.</p><div class="settings-actions"><input type="file" id="restoreFile" accept=".json" style="display:none"><button id="restoreBtn" class="btn secondary">Selecionar arquivo</button></div></div>
          <div class="settings-card"><h3>ℹ️ Sobre o sistema</h3><p>Financeiro Eduardo v0.3.0 — Sistema financeiro pessoal e profissional.</p></div>
        </section>

</main>

      <nav class="mobile-bottom-nav">
        <button class="nav-icon-btn active" id="mobileNavHome"><span class="nav-icon">⌂</span>Início</button>
        <button class="nav-icon-btn" id="mobileNavTx"><span class="nav-icon">≡</span>Movimentos</button>
        <button class="nav-icon-btn" id="mobileNavServices"><span class="nav-icon">▣</span>Serviços</button>
        <button class="nav-icon-btn" id="mobileNavSettings"><span class="nav-icon">⚙</span>Config</button>
      </nav>
    </div>`;
  document.querySelector('#newBtn').onclick=openModal;
  document.querySelectorAll('[data-open-new]').forEach(b=>b.onclick=openModal);
  document.querySelector('#logoutBtn').onclick=logout;
  document.querySelector('#month').onchange=async e=>{state.month=e.target.value;await refresh();};
  document.querySelector('#filterSearch').oninput=e=>{state.filters.q=e.target.value;clearTimeout(window.__financeiroSearch);window.__financeiroSearch=setTimeout(refresh,250);};
  document.querySelector('#filterType').onchange=async e=>{state.filters.type=e.target.value;await refresh();};
  document.querySelector('#filterCategory').onchange=async e=>{state.filters.category_id=e.target.value;await refresh();};
  document.querySelector('#filterStatus').onchange=async e=>{state.filters.status=e.target.value;await refresh();};
  document.querySelector('#exportBtn').onclick=exportCsv;

  document.querySelector('#printBtn').onclick=printReport;
  document.querySelector('#setBudgetBtn').onclick=openBudgetModal;
  if(typeof window.__initServices==='function') window.__initServices();
  document.querySelector('#navSettings').onclick=()=>{document.body.className='settings-mode';document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));document.querySelector('#navSettings').classList.add('active');};
  document.querySelector('#mobileNavHome').onclick=()=>{document.querySelector('#navHome').click();document.querySelectorAll('.nav-icon-btn').forEach(b=>b.classList.remove('active'));document.querySelector('#mobileNavHome').classList.add('active');};
  document.querySelector('#mobileNavTx').onclick=()=>{document.querySelector('#navTransactions').click();document.querySelectorAll('.nav-icon-btn').forEach(b=>b.classList.remove('active'));document.querySelector('#mobileNavTx').classList.add('active');};
  document.querySelector('#mobileNavServices').onclick=()=>{document.querySelector('#navServices').click();document.querySelectorAll('.nav-icon-btn').forEach(b=>b.classList.remove('active'));document.querySelector('#mobileNavServices').classList.add('active');};
  document.querySelector('#mobileNavSettings').onclick=()=>{document.querySelector('#navSettings').click();document.querySelectorAll('.nav-icon-btn').forEach(b=>b.classList.remove('active'));document.querySelector('#mobileNavSettings').classList.add('active');};
  document.querySelector('#backupBtn').onclick=async ()=>{try{const r=await fetch(apiUrl('/api/backup'),{headers:{authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Falha no backup');const b=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`financeiro-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(ex){toast(ex.message,'error');}};

  document.querySelector('#navTransactions').onclick=()=>document.querySelector('#transactionsSection').scrollIntoView({behavior:'smooth'});
  document.querySelector('#navCategories').onclick=()=>document.querySelector('#categoriesSection').scrollIntoView({behavior:'smooth'});
  document.querySelector('#navServices').onclick=()=>{document.querySelector('.app-shell').classList.add('service-mode');document.querySelectorAll('.sidebar-nav .nav-item').forEach(x=>x.classList.remove('active'));document.querySelector('#navServices').classList.add('active');if(typeof window.__openServices==='function')window.__openServices();};
  document.querySelector('#newCategoryBtn').onclick=()=>openCategoryModal();
  document.querySelector('#newAccountBtn').onclick=()=>openAccountModal();
  document.querySelector('#transferBtn').onclick=openTransferModal;
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeTx(b.dataset.delete));
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(state.transactions.find(t=>t.id===b.dataset.edit)));
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetails(state.transactions.find(t=>t.id===b.dataset.detail)));
  document.querySelectorAll('[data-account-edit]').forEach(b=>b.onclick=()=>openAccountModal(state.accounts.find(a=>a.id===b.dataset.accountEdit)));
  document.querySelectorAll('[data-category-edit]').forEach(b=>b.onclick=()=>openCategoryModal(state.categories.find(c=>c.id===b.dataset.categoryEdit)));
}

function filterCategoryOptions(type){
  const sel=document.querySelector('#category');if(!sel)return;
  [...sel.options].forEach(o=>{if(!o.value)return;o.hidden=!(o.dataset.type===type||o.dataset.type==='ambos');});
  if(sel.selectedOptions[0]?.hidden)sel.value='';
}

function openModal(tx=null){
  const editing=Boolean(tx?.id);
  const options=state.categories.map(c=>`<option value="${c.id}" data-type="${c.type}">${esc((c.icon||'')+' '+c.name)}</option>`).join('');
  const accountOptions=state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend',`<div id="modal" class="modal"><div class="modal-card">
    <div class="modal-head"><div><span class="eyebrow">MOVIMENTAÇÃO</span><h2>${editing?'Editar lançamento':'Novo lançamento'}</h2><p>Registre uma entrada ou saída no seu financeiro.</p></div><button id="closeModal" class="modal-close">×</button></div>
    <form id="txForm" class="form">
      <div class="type-switch full"><label><input type="radio" name="type" value="entrada" ${tx?.type!=='saida'?'checked':''}><span class="type-entry">↑ Entrada</span></label><label><input type="radio" name="type" value="saida" ${tx?.type==='saida'?'checked':''}><span class="type-exit">↓ Saída</span></label></div>
      <label class="field full"><span>Descrição</span><input name="description" placeholder="Ex.: Pagamento de cliente" value="${esc(tx?.description||'')}" required></label>
      <label class="field"><span>Valor</span><div class="money-input"><b>R$</b><input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" value="${esc(tx?amountValue(tx.amount_cents):'')}" required></div></label>
      <label class="field"><span>Data</span><input name="transaction_date" type="date" value="${esc(tx?.transaction_date||today())}" required></label>
      <label class="field"><span>Categoria</span><select name="category_id" id="category"><option value="">Sem categoria</option>${options}</select></label>
      <label class="field"><span>Conta</span><select name="account_id" id="account"><option value="">Sem conta</option>${accountOptions}</select></label>
      <label class="field"><span>Forma de pagamento</span><select name="payment_method"><option value="Pix">Pix</option><option value="Dinheiro">Dinheiro</option><option value="Cartão de débito">Cartão de débito</option><option value="Cartão de crédito">Cartão de crédito</option><option value="Transferência">Transferência</option><option value="Boleto">Boleto</option><option value="Outro">Outro</option></select></label>
      <label class="field"><span>Status</span><select name="status"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="recebido">Recebido</option><option value="atrasado">Atrasado</option></select></label>
      <label class="field"><span>Recorrência</span><select name="recurring_type"><option value="nenhuma">Não recorrente</option><option value="mensal">Mensal</option></select></label>
      <label class="field"><span>Parcelas</span><input name="installment_count" type="number" min="1" step="1" value="${esc(tx?.installment_count||1)}"></label>
      <label class="field"><span>Parcela atual</span><input name="installment_number" type="number" min="1" step="1" value="${esc(tx?.installment_number||1)}"></label>
      <label class="field full"><span>Observações</span><textarea name="notes" rows="3" placeholder="Opcional">${esc(tx?.notes||'')}</textarea></label>
      <div id="txError" class="error full"></div>
      <div class="modal-actions full"><button type="button" class="btn secondary" id="cancelModal">Cancelar</button><button class="btn primary" type="submit">${editing?'Salvar alterações':'Salvar lançamento'}</button></div>
    </form>
  </div></div>`);
  const modal=document.querySelector('#modal');
  const close=()=>modal.remove();document.querySelector('#closeModal').onclick=close;document.querySelector('#cancelModal').onclick=close;
  modal.onclick=e=>{if(e.target===modal)close();};
  if(tx?.category_id)document.querySelector('#category').value=tx.category_id;
  if(tx?.account_id)document.querySelector('#account').value=tx.account_id;
  if(tx?.payment_method)document.querySelector('select[name="payment_method"]').value=tx.payment_method;
  document.querySelector('select[name="status"]').value=tx?.status||((tx?.type||'entrada')==='entrada'?'recebido':'pago');
  document.querySelector('select[name="recurring_type"]').value=tx?.recurring_type||'nenhuma';
  document.querySelectorAll('input[name="type"]').forEach(r=>r.onchange=e=>filterCategoryOptions(e.target.value));filterCategoryOptions(tx?.type||'entrada');
  document.querySelector('#txForm').onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);const payload=Object.fromEntries(fd.entries());const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;
    try{await api(editing?`/api/transactions/${tx.id}`:'/api/transactions',{method:editing?'PUT':'POST',body:JSON.stringify(payload)});modal.remove();state.month=payload.transaction_date.slice(0,7);await refresh();}
    catch(ex){document.querySelector('#txError').textContent=ex.message;btn.disabled=false;}
  };
}

function openDetails(tx){
  if(!tx)return;
  document.body.insertAdjacentHTML('beforeend',`<div id="detailModal" class="modal"><div class="modal-card"><div class="modal-head"><div><span class="eyebrow">DETALHES</span><h2>${esc(tx.description)}</h2><p>${esc(tx.transaction_date.split('-').reverse().join('/'))}</p></div><button class="modal-close" id="closeDetail">×</button></div><div class="detail-grid"><span>Tipo</span><strong>${tx.type==='entrada'?'Entrada':'Saída'}</strong><span>Status</span><strong>${statusLabel(tx.status)}</strong><span>Conta</span><strong>${esc(tx.account_name||'Sem conta')}</strong><span>Categoria</span><strong>${esc(tx.category_name||'Sem categoria')}</strong><span>Valor</span><strong>${money(tx.amount_cents)}</strong><span>Parcelamento</span><strong>${esc(tx.installment_number||1)}/${esc(tx.installment_count||1)}</strong><span>Recorrência</span><strong>${tx.recurring_type==='mensal'?'Mensal':'Não recorrente'}</strong><span>Observações</span><strong>${esc(tx.notes||'-')}</strong></div><div class="modal-actions full"><button class="btn secondary" id="editFromDetail">Editar</button></div></div></div>`);
  const modal=document.querySelector('#detailModal');document.querySelector('#closeDetail').onclick=()=>modal.remove();document.querySelector('#editFromDetail').onclick=()=>{modal.remove();openModal(tx);};modal.onclick=e=>{if(e.target===modal)modal.remove();};
}

function openCategoryModal(category=null){
  const editing=Boolean(category?.id);
  document.body.insertAdjacentHTML('beforeend',`<div id="categoryModal" class="modal"><div class="modal-card"><div class="modal-head"><div><span class="eyebrow">CATEGORIA</span><h2>${editing?'Editar categoria':'Nova categoria'}</h2></div><button class="modal-close" id="closeCategory">×</button></div><form id="categoryForm" class="form"><label class="field"><span>Nome</span><input name="name" value="${esc(category?.name||'')}" required></label><label class="field"><span>Ícone</span><input name="icon" value="${esc(category?.icon||'📁')}"></label><label class="field full"><span>Tipo</span><select name="type"><option value="ambos">Ambos</option><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label><div id="categoryError" class="error full"></div><div class="modal-actions full"><button class="btn secondary" type="button" id="cancelCategory">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form></div></div>`);
  const modal=document.querySelector('#categoryModal');const close=()=>modal.remove();document.querySelector('#closeCategory').onclick=close;document.querySelector('#cancelCategory').onclick=close;document.querySelector('select[name="type"]').value=category?.type||'ambos';
  document.querySelector('#categoryForm').onsubmit=async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api(editing?`/api/categories/${category.id}`:'/api/categories',{method:editing?'PUT':'POST',body:JSON.stringify(payload)});close();await refresh();}catch(ex){document.querySelector('#categoryError').textContent=ex.message;}};
}

function openAccountModal(account=null){
  const editing=Boolean(account?.id);
  document.body.insertAdjacentHTML('beforeend',`<div id="accountModal" class="modal"><div class="modal-card"><div class="modal-head"><div><span class="eyebrow">CONTA</span><h2>${editing?'Editar conta':'Nova conta'}</h2></div><button class="modal-close" id="closeAccount">×</button></div><form id="accountForm" class="form"><label class="field"><span>Nome</span><input name="name" value="${esc(account?.name||'')}" required></label><label class="field"><span>Tipo</span><select name="type"><option value="carteira">Carteira</option><option value="conta_corrente">Conta corrente</option><option value="poupanca">Poupança</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option><option value="investimento">Investimento</option></select></label><label class="field full"><span>Saldo inicial</span><div class="money-input"><b>R$</b><input name="opening_balance" type="number" step="0.01" value="${esc(amountValue(account?.opening_balance_cents))}"></div></label><div id="accountError" class="error full"></div><div class="modal-actions full"><button class="btn secondary" type="button" id="cancelAccount">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form></div></div>`);
  const modal=document.querySelector('#accountModal');const close=()=>modal.remove();document.querySelector('#closeAccount').onclick=close;document.querySelector('#cancelAccount').onclick=close;document.querySelector('select[name="type"]').value=account?.type||'carteira';
  document.querySelector('#accountForm').onsubmit=async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api(editing?`/api/accounts/${account.id}`:'/api/accounts',{method:editing?'PUT':'POST',body:JSON.stringify(payload)});close();await refresh();}catch(ex){document.querySelector('#accountError').textContent=ex.message;}};
}

function openTransferModal(){
  const options=state.accounts.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend',`<div id="transferModal" class="modal"><div class="modal-card"><div class="modal-head"><div><span class="eyebrow">TRANSFERÊNCIA</span><h2>Transferir entre contas</h2></div><button class="modal-close" id="closeTransfer">×</button></div><form id="transferForm" class="form"><label class="field"><span>Origem</span><select name="from_account_id" required>${options}</select></label><label class="field"><span>Destino</span><select name="to_account_id" required>${options}</select></label><label class="field"><span>Valor</span><div class="money-input"><b>R$</b><input name="amount" type="number" min="0.01" step="0.01" required></div></label><label class="field"><span>Data</span><input name="transaction_date" type="date" value="${today()}" required></label><label class="field full"><span>Descrição</span><input name="description" value="Transferência entre contas"></label><div id="transferError" class="error full"></div><div class="modal-actions full"><button class="btn secondary" id="cancelTransfer" type="button">Cancelar</button><button class="btn primary" type="submit">Transferir</button></div></form></div></div>`);
  const modal=document.querySelector('#transferModal');const close=()=>modal.remove();document.querySelector('#closeTransfer').onclick=close;document.querySelector('#cancelTransfer').onclick=close;
  document.querySelector('#transferForm').onsubmit=async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api('/api/transfers',{method:'POST',body:JSON.stringify(payload)});close();state.month=payload.transaction_date.slice(0,7);await refresh();}catch(ex){document.querySelector('#transferError').textContent=ex.message;}};
}

async function removeTx(id){const yes=await confirmDialog('Excluir este lançamento?');if(!yes)return;try{await api(`/api/transactions/${id}`,{method:'DELETE'});await refresh();}catch(ex){toast(ex.message, 'error');}}
async function exportCsv(){try{const r=await fetch(apiUrl('/api/export.csv'),{headers:{authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Não foi possível exportar.');const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='financeiro-eduardo.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(ex){toast(ex.message, 'error');}}
async function logout(){try{await api('/api/logout',{method:'POST'});}catch{}localStorage.removeItem('financeiro_token');token='';renderLogin();}
async function refresh(){await load();renderApp();}
async function boot(){if(!token)return renderLogin();try{await refresh();}catch(ex){if(token){await renderLogin();const err=document.querySelector('#authError');if(err)err.textContent=ex.message||'Não foi possível carregar o painel.';}}}
if(location.protocol.startsWith('http')&&'serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').then(reg=>{reg.update();if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});}).catch(()=>{});
boot();
