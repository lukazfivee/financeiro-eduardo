const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
const nowIso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const PASSWORD_ITERATIONS = 10000;
const PAYMENT_STATUSES = ['pendente', 'pago', 'recebido', 'atrasado'];
const SERVICE_STATUSES = ['orcamento', 'aprovado', 'em_andamento', 'concluido', 'cancelado'];
const RECURRENCE_TYPES = ['nenhuma', 'mensal'];

const cents = value => Math.round(Number(value || 0) * 100);
const dateOk = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const monthOk = value => /^\d{4}-\d{2}$/.test(String(value || ''));
const text = value => String(value || '').trim();
const optionalText = value => text(value) || null;
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

async function ensureColumns(env, table, columns) {
  const existing = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
  const names = new Set((existing.results || []).map(column => column.name));
  for (const column of columns) {
    if (!names.has(column.name)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column.sql}`).run();
  }
}

async function ensureAppSchema(env) {
  await ensureColumns(env, 'transactions', [
    { name: 'status', sql: `status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pendente','pago','recebido','atrasado'))` },
    { name: 'recurring_type', sql: `recurring_type TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recurring_type IN ('nenhuma','mensal'))` },
    { name: 'installment_count', sql: `installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count >= 1)` },
    { name: 'installment_number', sql: `installment_number INTEGER NOT NULL DEFAULT 1 CHECK (installment_number >= 1)` }
  ]);
  await ensureColumns(env, 'service_transactions', [
    { name: 'payment_status', sql: `payment_status TEXT NOT NULL DEFAULT 'pendente' CHECK (payment_status IN ('pendente','pago','recebido','atrasado'))` },
    { name: 'service_status', sql: `service_status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (service_status IN ('orcamento','aprovado','em_andamento','concluido','cancelado'))` },
    { name: 'contracted_amount_cents', sql: `contracted_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (contracted_amount_cents >= 0)` },
    { name: 'received_amount_cents', sql: `received_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (received_amount_cents >= 0)` },
    { name: 'expected_cost_cents', sql: `expected_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (expected_cost_cents >= 0)` },
    { name: 'actual_cost_cents', sql: `actual_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (actual_cost_cents >= 0)` },
    { name: 'recurring_type', sql: `recurring_type TEXT NOT NULL DEFAULT 'nenhuma' CHECK (recurring_type IN ('nenhuma','mensal'))` },
    { name: 'installment_count', sql: `installment_count INTEGER NOT NULL DEFAULT 1 CHECK (installment_count >= 1)` },
    { name: 'installment_number', sql: `installment_number INTEGER NOT NULL DEFAULT 1 CHECK (installment_number >= 1)` }
  ]);
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltParts = String(saltHex || '').match(/.{1,2}/g);
  if (!saltParts?.length) throw new Error('Salt de senha inválido.');
  const salt = Uint8Array.from(saltParts.map(x => parseInt(x, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes); crypto.getRandomValues(arr);
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
}

function bearer(request) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function currentUser(request, env) {
  const token = bearer(request); if (!token) return null;
  const hash = await sha256Hex(token);
  const now = Date.now();
  const row = await env.DB.prepare(`SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).bind(hash, now).first();
  if (row) await env.DB.prepare(`UPDATE sessions SET last_seen_at=? WHERE token_hash=?`).bind(nowIso(), hash).run();
  return row;
}

async function audit(env, userId, action, entityType, entityId = null, details = null) {
  await env.DB.prepare(`INSERT INTO audit_log(user_id,action,entity_type,entity_id,details_json,created_at) VALUES(?,?,?,?,?,?)`)
    .bind(userId, action, entityType, entityId, details ? JSON.stringify(details) : null, nowIso()).run();
}

async function body(request) { try { return await request.json(); } catch { return {}; } }

async function seedDefaultCategories(env, userId) {
  const items = [
    ['Salário','entrada','💰'],['Freelance','entrada','🧾'],['Outras entradas','entrada','➕'],
    ['Moradia','saida','🏠'],['Alimentação','saida','🍽️'],['Transporte','saida','🚗'],['Saúde','saida','❤️'],['Lazer','saida','🎮'],['Contas','saida','💡'],['Outras saídas','saida','➖']
  ];
  const ts = nowIso();
  for (const [name,type,icon] of items) {
    await env.DB.prepare(`INSERT INTO categories(id,user_id,name,type,icon,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).bind(uid(),userId,name,type,icon,ts,ts).run();
  }
}

async function api(request, env, url) {
  const path = url.pathname;

  if (path === '/health') return json({ ok: true, service: 'financeiro-eduardo' });

  if (path === '/api/setup' && request.method === 'POST') {
    const count = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users`).first();
    if ((count?.c || 0) > 0) return json({ error: 'Sistema já configurado.' }, 409);
    const b = await body(request);
    const name = String(b.name || '').trim(); const email = String(b.email || '').trim().toLowerCase(); const password = String(b.password || '');
    if (!name || !email || password.length < 8) return json({ error: 'Informe nome, e-mail e senha com pelo menos 8 caracteres.' }, 400);
    const salt = randomHex(16); const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS); const id = uid(); const ts = nowIso();
    await env.DB.prepare(`INSERT INTO users(id,name,email,password_salt,password_hash,password_iterations,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id,name,email,salt,hash,PASSWORD_ITERATIONS,ts,ts).run();
    await seedDefaultCategories(env,id); await audit(env,id,'setup','user',id);
    return json({ ok: true });
  }

  if (path === '/api/setup/status' && request.method === 'GET') {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users`).first();
    return json({ configured: (row?.c || 0) > 0 });
  }

  if (path === '/api/login' && request.method === 'POST') {
    const b = await body(request); const email = String(b.email || '').trim().toLowerCase(); const password = String(b.password || '');
    const u = await env.DB.prepare(`SELECT * FROM users WHERE email=?`).bind(email).first();
    if (!u) return json({ error: 'E-mail ou senha inválidos.' }, 401);
    const hash = await pbkdf2(password, u.password_salt, Number(u.password_iterations) || PASSWORD_ITERATIONS);
    if (hash !== u.password_hash) return json({ error: 'E-mail ou senha inválidos.' }, 401);
    const token = randomHex(32); const tokenHash = await sha256Hex(token); const ts = nowIso(); const expires = Date.now() + 1000*60*60*24*30;
    await env.DB.prepare(`INSERT INTO sessions(token_hash,user_id,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?)`).bind(tokenHash,u.id,ts,ts,expires).run();
    await env.DB.prepare(`UPDATE users SET last_login_at=? WHERE id=?`).bind(ts,u.id).run();
    return json({ token, user: { id:u.id, name:u.name, email:u.email } });
  }

  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Não autenticado.' }, 401);
  await ensureAppSchema(env);

  if (path === '/api/me' && request.method === 'GET') return json({ user });

  if (path === '/api/logout' && request.method === 'POST') {
    const token = bearer(request); if (token) await env.DB.prepare(`DELETE FROM sessions WHERE token_hash=?`).bind(await sha256Hex(token)).run();
    return json({ ok:true });
  }

  if (path === '/api/categories' && request.method === 'GET') {
    const r = await env.DB.prepare(`SELECT id,name,type,icon FROM categories WHERE user_id=? ORDER BY name`).bind(user.id).all();
    return json({ items:r.results || [] });
  }

  if (path === '/api/categories' && request.method === 'POST') {
    const b = await body(request); const name=String(b.name||'').trim(); const type=['entrada','saida','ambos'].includes(b.type)?b.type:'ambos';
    if (!name) return json({error:'Nome obrigatório.'},400); const id=uid(), ts=nowIso();
    await env.DB.prepare(`INSERT INTO categories(id,user_id,name,type,icon,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).bind(id,user.id,name,type,String(b.icon||'📁'),ts,ts).run();
    await audit(env,user.id,'create','category',id,{name,type}); return json({ok:true,id},201);
  }

  if (path === '/api/services' && request.method === 'GET') {
    const month = url.searchParams.get('month');
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category');
    let sql = `SELECT * FROM service_transactions WHERE user_id=?`;
    const binds=[user.id];
    if (month && monthOk(month)) { sql += ` AND substr(transaction_date,1,7)=?`; binds.push(month); }
    if (['entrada','saida'].includes(type)) { sql += ` AND type=?`; binds.push(type); }
    if (PAYMENT_STATUSES.includes(status)) { sql += ` AND payment_status=?`; binds.push(status); }
    if (category) { sql += ` AND category=?`; binds.push(category); }
    sql += ` ORDER BY transaction_date DESC, created_at DESC`;
    const r=await env.DB.prepare(sql).bind(...binds).all();
    return json({items:r.results||[]});
  }

  if (path === '/api/services' && request.method === 'POST') {
    const b=await body(request);
    const type=b.type==='entrada'?'entrada':b.type==='saida'?'saida':null;
    const serviceName=String(b.service_name||'').trim();
    const clientName=String(b.client_name||'').trim();
    const description=String(b.description||'').trim();
    const amountCents=cents(b.amount);
    const date=String(b.transaction_date||'');
    if(!type||!serviceName||!description||!Number.isFinite(amountCents)||amountCents<=0||!dateOk(date)) return json({error:'Preencha serviço, descrição, valor e data.'},400);
    const paymentStatus=choice(b.payment_status,PAYMENT_STATUSES,type==='entrada'?'recebido':'pendente');
    const serviceStatus=choice(b.service_status,SERVICE_STATUSES,'em_andamento');
    const recurringType=choice(b.recurring_type,RECURRENCE_TYPES,'nenhuma');
    const installmentCount=Math.max(1, Number.parseInt(b.installment_count || '1', 10) || 1);
    const installmentNumber=Math.min(installmentCount, Math.max(1, Number.parseInt(b.installment_number || '1', 10) || 1));
    const id=uid(),ts=nowIso();
    await env.DB.prepare(`INSERT INTO service_transactions(id,user_id,service_name,client_name,type,description,amount_cents,transaction_date,category,payment_method,notes,payment_status,service_status,contracted_amount_cents,received_amount_cents,expected_cost_cents,actual_cost_cents,recurring_type,installment_count,installment_number,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,user.id,serviceName,clientName||null,type,description,amountCents,date,optionalText(b.category),optionalText(b.payment_method),optionalText(b.notes),paymentStatus,serviceStatus,cents(b.contracted_amount),cents(b.received_amount),cents(b.expected_cost),cents(b.actual_cost),recurringType,installmentCount,installmentNumber,ts,ts).run();
    await audit(env,user.id,'create','service_transaction',id,{serviceName,clientName,type,amountCents,date});
    return json({ok:true,id},201);
  }

  if (path.startsWith('/api/services/') && request.method === 'PUT') {
    const id=path.split('/').pop();
    const found=await env.DB.prepare(`SELECT id FROM service_transactions WHERE id=? AND user_id=?`).bind(id,user.id).first();
    if(!found) return json({error:'Lançamento de serviço não encontrado.'},404);
    const b=await body(request);
    const type=b.type==='entrada'?'entrada':b.type==='saida'?'saida':null;
    const serviceName=text(b.service_name), description=text(b.description), amountCents=cents(b.amount), date=String(b.transaction_date||'');
    if(!type||!serviceName||!description||!Number.isFinite(amountCents)||amountCents<=0||!dateOk(date)) return json({error:'Preencha serviço, descrição, valor e data.'},400);
    const paymentStatus=choice(b.payment_status,PAYMENT_STATUSES,type==='entrada'?'recebido':'pendente');
    const serviceStatus=choice(b.service_status,SERVICE_STATUSES,'em_andamento');
    const recurringType=choice(b.recurring_type,RECURRENCE_TYPES,'nenhuma');
    const installmentCount=Math.max(1, Number.parseInt(b.installment_count || '1', 10) || 1);
    const installmentNumber=Math.min(installmentCount, Math.max(1, Number.parseInt(b.installment_number || '1', 10) || 1));
    await env.DB.prepare(`UPDATE service_transactions SET service_name=?,client_name=?,type=?,description=?,amount_cents=?,transaction_date=?,category=?,payment_method=?,notes=?,payment_status=?,service_status=?,contracted_amount_cents=?,received_amount_cents=?,expected_cost_cents=?,actual_cost_cents=?,recurring_type=?,installment_count=?,installment_number=?,updated_at=? WHERE id=? AND user_id=?`)
      .bind(serviceName,optionalText(b.client_name),type,description,amountCents,date,optionalText(b.category),optionalText(b.payment_method),optionalText(b.notes),paymentStatus,serviceStatus,cents(b.contracted_amount),cents(b.received_amount),cents(b.expected_cost),cents(b.actual_cost),recurringType,installmentCount,installmentNumber,nowIso(),id,user.id).run();
    await audit(env,user.id,'update','service_transaction',id,{serviceName,type,amountCents,date});
    return json({ok:true});
  }

  if (path.startsWith('/api/services/') && request.method === 'DELETE') {
    const id=path.split('/').pop();
    const found=await env.DB.prepare(`SELECT id FROM service_transactions WHERE id=? AND user_id=?`).bind(id,user.id).first();
    if(!found) return json({error:'Lançamento de serviço não encontrado.'},404);
    await env.DB.prepare(`DELETE FROM service_transactions WHERE id=? AND user_id=?`).bind(id,user.id).run();
    await audit(env,user.id,'delete','service_transaction',id);
    return json({ok:true});
  }

  if (path === '/api/services/dashboard' && request.method === 'GET') {
    const month=url.searchParams.get('month') || new Date().toISOString().slice(0,7);
    const summary=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN type='entrada' THEN amount_cents ELSE 0 END),0) receitas, COALESCE(SUM(CASE WHEN type='saida' THEN amount_cents ELSE 0 END),0) custos, COALESCE(SUM(contracted_amount_cents),0) contratado, COALESCE(SUM(received_amount_cents),0) recebido, COALESCE(SUM(expected_cost_cents),0) custo_previsto, COALESCE(SUM(actual_cost_cents),0) custo_realizado, COUNT(DISTINCT service_name) servicos, COUNT(DISTINCT CASE WHEN client_name IS NOT NULL AND client_name<>'' THEN client_name END) clientes FROM service_transactions WHERE user_id=? AND substr(transaction_date,1,7)=?`).bind(user.id,month).first();
    const total=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN type='entrada' THEN amount_cents ELSE -amount_cents END),0) resultado FROM service_transactions WHERE user_id=?`).bind(user.id).first();
    const byService=await env.DB.prepare(`SELECT service_name, COALESCE(MAX(client_name),'') client_name, COALESCE(MAX(service_status),'em_andamento') service_status, COALESCE(SUM(CASE WHEN type='entrada' THEN amount_cents ELSE 0 END),0) receitas_cents, COALESCE(SUM(CASE WHEN type='saida' THEN amount_cents ELSE 0 END),0) custos_cents, COALESCE(MAX(contracted_amount_cents),0) contratado_cents, COALESCE(MAX(received_amount_cents),0) recebido_cents, COALESCE(MAX(expected_cost_cents),0) custo_previsto_cents, COALESCE(SUM(CASE WHEN type='saida' THEN amount_cents ELSE 0 END),0) custo_realizado_cents FROM service_transactions WHERE user_id=? AND substr(transaction_date,1,7)=? GROUP BY service_name ORDER BY receitas_cents DESC, service_name LIMIT 10`).bind(user.id,month).all();
    return json({month,receitas_cents:summary?.receitas||0,custos_cents:summary?.custos||0,lucro_cents:(summary?.receitas||0)-(summary?.custos||0),resultado_total_cents:total?.resultado||0,contratado_cents:summary?.contratado||0,recebido_cents:summary?.recebido||0,a_receber_cents:Math.max(0,(summary?.contratado||0)-(summary?.recebido||0)),custo_previsto_cents:summary?.custo_previsto||0,custo_realizado_cents:summary?.custo_realizado||0,servicos:summary?.servicos||0,clientes:summary?.clientes||0,by_service:byService.results||[]});
  }

  if (path === '/api/transactions' && request.method === 'GET') {
    const month = url.searchParams.get('month');
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const category = url.searchParams.get('category_id');
    let sql = `SELECT t.*, c.name category_name, c.icon category_icon FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE t.user_id=?`;
    const binds=[user.id];
    if (month && monthOk(month)) { sql += ` AND substr(t.transaction_date,1,7)=?`; binds.push(month); }
    if (['entrada','saida'].includes(type)) { sql += ` AND t.type=?`; binds.push(type); }
    if (PAYMENT_STATUSES.includes(status)) { sql += ` AND t.status=?`; binds.push(status); }
    if (category) { sql += ` AND t.category_id=?`; binds.push(category); }
    sql += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;
    const r = await env.DB.prepare(sql).bind(...binds).all(); return json({items:r.results||[]});
  }

  if (path === '/api/transactions' && request.method === 'POST') {
    const b=await body(request); const type=b.type==='entrada'?'entrada':b.type==='saida'?'saida':null; const description=String(b.description||'').trim();
    const amountCents=cents(b.amount); const date=String(b.transaction_date||'');
    if(!type||!description||!Number.isFinite(amountCents)||amountCents<=0||!dateOk(date)) return json({error:'Dados do lançamento inválidos.'},400);
    const status=choice(b.status,PAYMENT_STATUSES,type==='entrada'?'recebido':'pago');
    const recurringType=choice(b.recurring_type,RECURRENCE_TYPES,'nenhuma');
    const installmentCount=Math.max(1, Number.parseInt(b.installment_count || '1', 10) || 1);
    const installmentNumber=Math.min(installmentCount, Math.max(1, Number.parseInt(b.installment_number || '1', 10) || 1));
    const id=uid(),ts=nowIso();
    await env.DB.prepare(`INSERT INTO transactions(id,user_id,type,description,amount_cents,transaction_date,category_id,payment_method,notes,status,recurring_type,installment_count,installment_number,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,user.id,type,description,amountCents,date,b.category_id||null,optionalText(b.payment_method),optionalText(b.notes),status,recurringType,installmentCount,installmentNumber,ts,ts).run();
    await audit(env,user.id,'create','transaction',id,{type,amountCents,date}); return json({ok:true,id},201);
  }

  if (path.startsWith('/api/transactions/') && request.method === 'PUT') {
    const id=path.split('/').pop(); const found=await env.DB.prepare(`SELECT id FROM transactions WHERE id=? AND user_id=?`).bind(id,user.id).first();
    if(!found) return json({error:'Lançamento não encontrado.'},404);
    const b=await body(request); const type=b.type==='entrada'?'entrada':b.type==='saida'?'saida':null; const description=text(b.description);
    const amountCents=cents(b.amount); const date=String(b.transaction_date||'');
    if(!type||!description||!Number.isFinite(amountCents)||amountCents<=0||!dateOk(date)) return json({error:'Dados do lançamento inválidos.'},400);
    const status=choice(b.status,PAYMENT_STATUSES,type==='entrada'?'recebido':'pago');
    const recurringType=choice(b.recurring_type,RECURRENCE_TYPES,'nenhuma');
    const installmentCount=Math.max(1, Number.parseInt(b.installment_count || '1', 10) || 1);
    const installmentNumber=Math.min(installmentCount, Math.max(1, Number.parseInt(b.installment_number || '1', 10) || 1));
    await env.DB.prepare(`UPDATE transactions SET type=?,description=?,amount_cents=?,transaction_date=?,category_id=?,payment_method=?,notes=?,status=?,recurring_type=?,installment_count=?,installment_number=?,updated_at=? WHERE id=? AND user_id=?`)
      .bind(type,description,amountCents,date,b.category_id||null,optionalText(b.payment_method),optionalText(b.notes),status,recurringType,installmentCount,installmentNumber,nowIso(),id,user.id).run();
    await audit(env,user.id,'update','transaction',id,{type,amountCents,date});
    return json({ok:true});
  }

  if (path.startsWith('/api/transactions/') && request.method === 'DELETE') {
    const id=path.split('/').pop(); const found=await env.DB.prepare(`SELECT id FROM transactions WHERE id=? AND user_id=?`).bind(id,user.id).first();
    if(!found) return json({error:'Lançamento não encontrado.'},404);
    await env.DB.prepare(`DELETE FROM transactions WHERE id=? AND user_id=?`).bind(id,user.id).run(); await audit(env,user.id,'delete','transaction',id); return json({ok:true});
  }

  if (path === '/api/dashboard' && request.method === 'GET') {
    const month=url.searchParams.get('month') || new Date().toISOString().slice(0,7);
    const summary=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN type='entrada' THEN amount_cents ELSE 0 END),0) entradas, COALESCE(SUM(CASE WHEN type='saida' THEN amount_cents ELSE 0 END),0) saidas FROM transactions WHERE user_id=? AND substr(transaction_date,1,7)=?`).bind(user.id,month).first();
    const total=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN type='entrada' THEN amount_cents ELSE -amount_cents END),0) saldo FROM transactions WHERE user_id=?`).bind(user.id).first();
    const byCat=await env.DB.prepare(`SELECT COALESCE(c.name,'Sem categoria') name, COALESCE(c.icon,'📁') icon, SUM(t.amount_cents) total_cents FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE t.user_id=? AND t.type='saida' AND substr(t.transaction_date,1,7)=? GROUP BY c.id,c.name,c.icon ORDER BY total_cents DESC LIMIT 8`).bind(user.id,month).all();
    return json({month,entradas_cents:summary?.entradas||0,saidas_cents:summary?.saidas||0,saldo_mes_cents:(summary?.entradas||0)-(summary?.saidas||0),saldo_total_cents:total?.saldo||0,expenses_by_category:byCat.results||[]});
  }

  if (path === '/api/export.csv' && request.method === 'GET') {
    const r=await env.DB.prepare(`SELECT transaction_date,type,description,amount_cents,payment_method,notes FROM transactions WHERE user_id=? ORDER BY transaction_date`).bind(user.id).all();
    const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
    const lines=['Data;Tipo;Descrição;Valor;Forma de pagamento;Observações',...(r.results||[]).map(x=>[x.transaction_date,x.type,x.description,(x.amount_cents/100).toFixed(2).replace('.',','),x.payment_method,x.notes].map(esc).join(';'))];
    return new Response(lines.join('\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="financeiro-eduardo.csv"'}});
  }

  return json({error:'Rota não encontrada.'},404);
}

export default {
  async fetch(request, env) {
    try {
      const url=new URL(request.url);
      if (url.pathname === '/health' || url.pathname.startsWith('/api/')) return await api(request,env,url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('financeiro-eduardo worker error', error);
      return json({ error: 'Erro interno no servidor. Tente novamente em alguns segundos.' }, 500);
    }
  }
};
