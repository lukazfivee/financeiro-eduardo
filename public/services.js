(() => {
  const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(c)||0)/100);
  const monthLabel=v=>{if(!v)return'';const [y,m]=v.split('-');return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1));};
  const today=()=>new Date().toISOString().slice(0,10);
  const currentMonth=()=>new Date().toISOString().slice(0,7);
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  let month=currentMonth();
  let mounted=false;

  async function api(path,opts={}){
    const token=localStorage.getItem('financeiro_token')||'';
    const headers={'content-type':'application/json',...(opts.headers||{})};
    if(token) headers.authorization=`Bearer ${token}`;
    const r=await fetch(path,{...opts,headers});
    const ct=r.headers.get('content-type')||''; const data=ct.includes('application/json')?await r.json():await r.text();
    if(!r.ok) throw new Error(data?.error||'Erro na operação.');
    return data;
  }

  function ensureUi(){
    const shell=document.querySelector('.app-shell');
    const nav=document.querySelector('.sidebar-nav');
    const main=document.querySelector('.main-content');
    if(!shell||!nav||!main||document.querySelector('#navServices')) return;
    const btn=document.createElement('button');
    btn.className='nav-item';btn.id='navServices';btn.innerHTML='<span class="ui-icon">▣</span><span>Serviços</span>';
    nav.appendChild(btn);
    const section=document.createElement('section');section.id='servicesPage';section.className='services-page';main.appendChild(section);
    btn.onclick=()=>openServices();
    const first=nav.querySelector('.nav-item');
    if(first) first.addEventListener('click',()=>{shell.classList.remove('service-mode');nav.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));first.classList.add('active');});
    mounted=true;
  }

  async function openServices(){
    const shell=document.querySelector('.app-shell');const nav=document.querySelector('.sidebar-nav');
    if(!shell)return; shell.classList.add('service-mode');nav.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));document.querySelector('#navServices')?.classList.add('active');
    await renderServices();
  }

  async function renderServices(){
    const el=document.querySelector('#servicesPage');if(!el)return;
    el.innerHTML='<div class="services-loading">Carregando serviços...</div>';
    try{
      const [dash,list]=await Promise.all([api(`/api/services/dashboard?month=${month}`),api(`/api/services?month=${month}`)]);
      el.innerHTML=`<header class="page-header services-header"><div><span class="eyebrow">FINANCEIRO PROFISSIONAL</span><h1>Serviços</h1><p>Receitas e custos de trabalho separados do financeiro pessoal.</p></div><div class="header-actions"><input id="servicesMonth" class="month-input" type="month" value="${month}"><button id="newServiceBtn" class="btn primary"><span class="ui-icon">+</span> Novo lançamento</button></div></header>
      <div class="kpi-grid services-kpis">
        <article class="kpi-card service-revenue"><div class="kpi-top"><span class="kpi-icon income">↑</span><span>Receitas de serviços</span></div><strong class="positive">${money(dash.receitas_cents)}</strong><small>${monthLabel(month)}</small></article>
        <article class="kpi-card"><div class="kpi-top"><span class="kpi-icon expense">↓</span><span>Custos dos serviços</span></div><strong class="negative">${money(dash.custos_cents)}</strong><small>${monthLabel(month)}</small></article>
        <article class="kpi-card"><div class="kpi-top"><span class="kpi-icon result">↗</span><span>Lucro do mês</span></div><strong class="${dash.lucro_cents>=0?'positive':'negative'}">${money(dash.lucro_cents)}</strong><small>Receitas menos custos</small></article>
        <article class="kpi-card balance-card"><div class="kpi-top"><span class="kpi-icon wallet">R$</span><span>Resultado acumulado</span></div><strong>${money(dash.resultado_total_cents)}</strong><small>${dash.servicos} serviços • ${dash.clientes} clientes</small></article>
      </div>
      <section class="dashboard-grid services-grid"><article class="panel"><div class="panel-head"><div><span class="eyebrow">RESULTADO POR SERVIÇO</span><h2>Serviços do mês</h2></div></div>${serviceSummary(dash.by_service||[])}</article><article class="panel services-separation"><div class="separation-icon">↔</div><h3>Financeiro separado</h3><p>Estes valores não entram no saldo pessoal. Assim você consegue acompanhar trabalho e vida pessoal sem misturar os dois caixas.</p></article></section>
      <section class="panel transactions-panel"><div class="panel-head"><div><span class="eyebrow">LANÇAMENTOS PROFISSIONAIS</span><h2>Movimentações de serviços</h2></div><span class="record-count">${list.items.length} lançamentos</span></div>${serviceTable(list.items)}</section>`;
      document.querySelector('#servicesMonth').onchange=e=>{month=e.target.value;renderServices();};
      document.querySelector('#newServiceBtn').onclick=openServiceModal;
      document.querySelectorAll('[data-service-delete]').forEach(b=>b.onclick=()=>removeService(b.dataset.serviceDelete));
    }catch(e){el.innerHTML=`<div class="services-error">${esc(e.message)}</div>`;}
  }

  function serviceSummary(items){
    if(!items.length)return '<div class="mini-empty"><span>▣</span><p>Nenhum serviço registrado neste mês.</p></div>';
    return `<div class="service-summary-list">${items.map(x=>{const profit=Number(x.receitas_cents||0)-Number(x.custos_cents||0);return `<div class="service-summary-row"><div><strong>${esc(x.service_name)}</strong><small>${esc(x.client_name||'Cliente não informado')}</small></div><div class="service-values"><span>Receita ${money(x.receitas_cents)}</span><span>Custo ${money(x.custos_cents)}</span><strong class="${profit>=0?'positive':'negative'}">${money(profit)}</strong></div></div>`;}).join('')}</div>`;
  }

  function serviceTable(items){
    if(!items.length)return '<div class="empty-state"><div class="empty-icon">▣</div><h3>Nenhum lançamento de serviço</h3><p>Adicione receitas ou custos relacionados aos seus serviços.</p></div>';
    return `<div class="table-wrap"><table><thead><tr><th>Serviço / Cliente</th><th>Descrição</th><th>Categoria</th><th>Data</th><th>Tipo</th><th class="value-col">Valor</th><th></th></tr></thead><tbody>${items.map(x=>`<tr><td><div class="tx-main"><span class="tx-symbol ${x.type}">${x.type==='entrada'?'↑':'↓'}</span><div><strong>${esc(x.service_name)}</strong><small>${esc(x.client_name||'Sem cliente')}</small></div></div></td><td>${esc(x.description)}</td><td><span class="category-pill">${esc(x.category||'Sem categoria')}</span></td><td>${esc(x.transaction_date.split('-').reverse().join('/'))}</td><td><span class="badge ${x.type==='entrada'?'in':'out'}">${x.type==='entrada'?'Receita':'Custo'}</span></td><td class="value-col ${x.type==='entrada'?'positive':'negative'}">${x.type==='entrada'?'+':'-'} ${money(x.amount_cents)}</td><td><button class="icon-btn" data-service-delete="${x.id}">×</button></td></tr>`).join('')}</tbody></table></div>`;
  }

  function openServiceModal(){
    document.body.insertAdjacentHTML('beforeend',`<div id="serviceModal" class="modal"><div class="modal-card"><div class="modal-head"><div><span class="eyebrow">SERVIÇO</span><h2>Novo lançamento de serviço</h2><p>Registre receita ou custo sem misturar com o financeiro pessoal.</p></div><button id="closeServiceModal" class="modal-close">×</button></div><form id="serviceForm" class="form"><div class="type-switch full"><label><input type="radio" name="type" value="entrada" checked><span class="type-entry">↑ Receita</span></label><label><input type="radio" name="type" value="saida"><span class="type-exit">↓ Custo</span></label></div><label class="field"><span>Nome do serviço</span><input name="service_name" placeholder="Ex.: Instalação de CFTV" required></label><label class="field"><span>Cliente</span><input name="client_name" placeholder="Nome do cliente"></label><label class="field full"><span>Descrição do lançamento</span><input name="description" placeholder="Ex.: Entrada do serviço / compra de material" required></label><label class="field"><span>Valor</span><div class="money-input"><b>R$</b><input name="amount" type="number" min="0.01" step="0.01" required></div></label><label class="field"><span>Data</span><input name="transaction_date" type="date" value="${today()}" required></label><label class="field"><span>Categoria</span><select name="category"><option>Pagamento do cliente</option><option>Material</option><option>Mão de obra</option><option>Transporte</option><option>Alimentação</option><option>Terceirização</option><option>Impostos</option><option>Outros</option></select></label><label class="field"><span>Forma de pagamento</span><select name="payment_method"><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Boleto</option><option>Outro</option></select></label><label class="field full"><span>Observações</span><textarea name="notes" rows="3"></textarea></label><div id="serviceError" class="error full"></div><div class="modal-actions full"><button id="cancelServiceModal" class="btn secondary" type="button">Cancelar</button><button class="btn primary" type="submit">Salvar lançamento</button></div></form></div></div>`);
    const modal=document.querySelector('#serviceModal');const close=()=>modal.remove();document.querySelector('#closeServiceModal').onclick=close;document.querySelector('#cancelServiceModal').onclick=close;
    document.querySelector('#serviceForm').onsubmit=async e=>{e.preventDefault();const payload=Object.fromEntries(new FormData(e.currentTarget).entries());const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;try{await api('/api/services',{method:'POST',body:JSON.stringify(payload)});month=payload.transaction_date.slice(0,7);close();await renderServices();}catch(ex){document.querySelector('#serviceError').textContent=ex.message;btn.disabled=false;}};
  }

  async function removeService(id){if(!confirm('Excluir este lançamento de serviço?'))return;try{await api(`/api/services/${id}`,{method:'DELETE'});await renderServices();}catch(e){alert(e.message);}}

  const observer=new MutationObserver(()=>ensureUi());observer.observe(document.body,{childList:true,subtree:true});ensureUi();
})();