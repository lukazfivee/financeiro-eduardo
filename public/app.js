const app=document.querySelector('#app');
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(c)||0)/100);
const today=()=>new Date().toISOString().slice(0,10);
const currentMonth=()=>new Date().toISOString().slice(0,7);
const monthLabel=v=>{if(!v)return'';const [y,m]=v.split('-');return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const amountValue=c=>((Number(c)||0)/100).toFixed(2);
const statusLabel=s=>({pendente:'Pendente',pago:'Pago',recebido:'Recebido',atrasado:'Atrasado'}[s]||'Pago');
let token=localStorage.getItem('financeiro_token')||'';
let state={user:null,categories:[],transactions:[],dashboard:null,month:currentMonth(),filters:{type:'',category_id:'',status:''}};

async function api(path,opts={}){
  const headers={'content-type':'application/json',...(opts.headers||{})};
  if(token)headers.authorization=`Bearer ${token}`;
  const r=await fetch(path,{...opts,headers});
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

function loginTemplate(configured){
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
        <span class="eyebrow">${configured?'BEM-VINDO DE VOLTA':'PRIMEIRO ACESSO'}</span>
        <h2>${configured?'Entre na sua conta':'Crie seu acesso'}</h2>
        <p>${configured?'Informe seus dados para acessar o painel.':'Cadastre o usuário administrador para começar.'}</p>
        <form id="authForm" class="auth-form">
          ${configured?'':`<label>Nome completo<input name="name" autocomplete="name" placeholder="Digite seu nome" required></label>`}
          <label>E-mail<input name="email" type="email" autocomplete="email" placeholder="seuemail@exemplo.com" required></label>
          <label>Senha<input name="password" type="password" minlength="8" autocomplete="current-password" placeholder="Mínimo de 8 caracteres" required></label>
          <button class="btn primary auth-submit" type="submit">${configured?'Entrar no painel':'Criar acesso'} <span>→</span></button>
          <div id="authError" class="error"></div>
        </form>
      </div>
    </section>
  </main>`;
}

async function renderLogin(){
  const s=await fetch('/api/setup/status').then(r=>r.json()).catch(()=>({configured:false}));
  app.innerHTML=loginTemplate(s.configured);
  document.querySelector('#authForm').onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(e.currentTarget);const payload=Object.fromEntries(fd.entries());
    const err=document.querySelector('#authError');const btn=e.currentTarget.querySelector('button[type="submit"]');
    err.textContent='';btn.disabled=true;btn.classList.add('loading');
    try{
      if(!s.configured)await api('/api/setup',{method:'POST',body:JSON.stringify(payload)});
      const res=await api('/api/login',{method:'POST',body:JSON.stringify(payload)});
      token=res.token;localStorage.setItem('financeiro_token',token);await boot();
    }catch(ex){err.textContent=ex.message;btn.disabled=false;btn.classList.remove('loading');}
  };
}

async function load(){
  const qs=new URLSearchParams({month:state.month});
  if(state.filters.type)qs.set('type',state.filters.type);
  if(state.filters.category_id)qs.set('category_id',state.filters.category_id);
  if(state.filters.status)qs.set('status',state.filters.status);
  const [me,cats,tx,dash]=await Promise.all([
    api('/api/me'),api('/api/categories'),api(`/api/transactions?${qs}`),api(`/api/dashboard?month=${state.month}`)
  ]);
  state.user=me.user;state.categories=cats.items;state.transactions=tx.items;state.dashboard=dash;
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
    <td><div class="tx-main"><span class="tx-symbol ${t.type}">${t.type==='entrada'?'↑':'↓'}</span><div><strong>${esc(t.description)}</strong><small>${esc(t.payment_method||'Não informado')}</small></div></div></td>
    <td><span class="category-pill">${esc((t.category_icon||'')+' '+(t.category_name||'Sem categoria'))}</span></td>
    <td>${esc(t.transaction_date.split('-').reverse().join('/'))}</td>
    <td><span class="badge ${t.type==='entrada'?'in':'out'}">${t.type==='entrada'?'Entrada':'Saída'}</span></td>
    <td><span class="badge status-${esc(t.status||'pago')}">${statusLabel(t.status)}</span></td>
    <td class="value-col ${t.type==='entrada'?'positive':'negative'}">${t.type==='entrada'?'+':'-'} ${money(t.amount_cents)}</td>
    <td><button class="icon-btn" title="Editar" data-edit="${t.id}">✎</button><button class="icon-btn" title="Excluir" data-delete="${t.id}">×</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function categoriesHtml(){
  const items=state.dashboard?.expenses_by_category||[];
  if(!items.length)return `<div class="mini-empty"><span>◌</span><p>Sem despesas por categoria neste mês.</p></div>`;
  const total=items.reduce((a,b)=>a+Number(b.total_cents||0),0);
  return `<div class="category-list">${items.map((x,i)=>{const pct=total?Math.round(Number(x.total_cents||0)/total*100):0;return `<div class="category-row">
    <div class="category-title"><span class="category-avatar tone-${i%5}">${esc(x.icon||'•')}</span><div><strong>${esc(x.name)}</strong><small>${pct}% das despesas</small></div></div>
    <div class="category-amount"><strong>${money(x.total_cents)}</strong><div class="progress"><span style="width:${Math.max(4,pct)}%"></span></div></div>
  </div>`;}).join('')}</div>`;
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

function renderApp(){
  const categoryFilterOptions=state.categories.map(c=>`<option value="${c.id}" ${state.filters.category_id===c.id?'selected':''}>${esc((c.icon||'')+' '+c.name)}</option>`).join('');
  app.innerHTML=`<div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-brand"><div class="brand-mark">R$</div><div><strong>Financeiro</strong><span>Eduardo</span></div></div>
      <nav class="sidebar-nav">
        <button class="nav-item active">${icon('home')}<span>Visão geral</span></button>
        <button class="nav-item" id="navTransactions">${icon('list')}<span>Movimentações</span></button>
        <button class="nav-item" id="navCategories">${icon('chart')}<span>Categorias</span></button>
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
        <article class="panel" id="categoriesSection"><div class="panel-head"><div><span class="eyebrow">DESPESAS</span><h2>Por categoria</h2></div></div>${categoriesHtml()}</article>
      </section>
      <section class="panel transactions-panel" id="transactionsSection">
        <div class="panel-head"><div><span class="eyebrow">HISTÓRICO</span><h2>Movimentações</h2></div><div class="panel-actions"><span class="record-count">${state.transactions.length} ${state.transactions.length===1?'lançamento':'lançamentos'}</span><button id="exportBtn" class="btn secondary">${icon('export')} Exportar CSV</button></div></div>
        <div class="filter-bar"><select id="filterType"><option value="">Todos os tipos</option><option value="entrada" ${state.filters.type==='entrada'?'selected':''}>Entradas</option><option value="saida" ${state.filters.type==='saida'?'selected':''}>Saídas</option></select><select id="filterCategory"><option value="">Todas as categorias</option>${categoryFilterOptions}</select><select id="filterStatus"><option value="">Todos os status</option><option value="pendente" ${state.filters.status==='pendente'?'selected':''}>Pendente</option><option value="pago" ${state.filters.status==='pago'?'selected':''}>Pago</option><option value="recebido" ${state.filters.status==='recebido'?'selected':''}>Recebido</option><option value="atrasado" ${state.filters.status==='atrasado'?'selected':''}>Atrasado</option></select></div>
        ${transactionsHtml()}
      </section>
    </main>
  </div>`;
  document.querySelector('#newBtn').onclick=openModal;
  document.querySelectorAll('[data-open-new]').forEach(b=>b.onclick=openModal);
  document.querySelector('#logoutBtn').onclick=logout;
  document.querySelector('#month').onchange=async e=>{state.month=e.target.value;await refresh();};
  document.querySelector('#filterType').onchange=async e=>{state.filters.type=e.target.value;await refresh();};
  document.querySelector('#filterCategory').onchange=async e=>{state.filters.category_id=e.target.value;await refresh();};
  document.querySelector('#filterStatus').onchange=async e=>{state.filters.status=e.target.value;await refresh();};
  document.querySelector('#exportBtn').onclick=exportCsv;
  document.querySelector('#navTransactions').onclick=()=>document.querySelector('#transactionsSection').scrollIntoView({behavior:'smooth'});
  document.querySelector('#navCategories').onclick=()=>document.querySelector('#categoriesSection').scrollIntoView({behavior:'smooth'});
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>removeTx(b.dataset.delete));
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(state.transactions.find(t=>t.id===b.dataset.edit)));
}

function filterCategoryOptions(type){
  const sel=document.querySelector('#category');if(!sel)return;
  [...sel.options].forEach(o=>{if(!o.value)return;o.hidden=!(o.dataset.type===type||o.dataset.type==='ambos');});
  if(sel.selectedOptions[0]?.hidden)sel.value='';
}

function openModal(tx=null){
  const editing=Boolean(tx?.id);
  const options=state.categories.map(c=>`<option value="${c.id}" data-type="${c.type}">${esc((c.icon||'')+' '+c.name)}</option>`).join('');
  document.body.insertAdjacentHTML('beforeend',`<div id="modal" class="modal"><div class="modal-card">
    <div class="modal-head"><div><span class="eyebrow">MOVIMENTAÇÃO</span><h2>${editing?'Editar lançamento':'Novo lançamento'}</h2><p>Registre uma entrada ou saída no seu financeiro.</p></div><button id="closeModal" class="modal-close">×</button></div>
    <form id="txForm" class="form">
      <div class="type-switch full"><label><input type="radio" name="type" value="entrada" ${tx?.type!=='saida'?'checked':''}><span class="type-entry">↑ Entrada</span></label><label><input type="radio" name="type" value="saida" ${tx?.type==='saida'?'checked':''}><span class="type-exit">↓ Saída</span></label></div>
      <label class="field full"><span>Descrição</span><input name="description" placeholder="Ex.: Pagamento de cliente" value="${esc(tx?.description||'')}" required></label>
      <label class="field"><span>Valor</span><div class="money-input"><b>R$</b><input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" value="${esc(tx?amountValue(tx.amount_cents):'')}" required></div></label>
      <label class="field"><span>Data</span><input name="transaction_date" type="date" value="${esc(tx?.transaction_date||today())}" required></label>
      <label class="field"><span>Categoria</span><select name="category_id" id="category"><option value="">Sem categoria</option>${options}</select></label>
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

async function removeTx(id){if(!confirm('Excluir este lançamento?'))return;try{await api(`/api/transactions/${id}`,{method:'DELETE'});await refresh();}catch(ex){alert(ex.message);}}
async function exportCsv(){try{const r=await fetch('/api/export.csv',{headers:{authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Não foi possível exportar.');const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='financeiro-eduardo.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}catch(ex){alert(ex.message);}}
async function logout(){try{await api('/api/logout',{method:'POST'});}catch{}localStorage.removeItem('financeiro_token');token='';renderLogin();}
async function refresh(){await load();renderApp();}
async function boot(){if(!token)return renderLogin();try{await refresh();}catch{if(token)renderLogin();}}
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
boot();
