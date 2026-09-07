const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = 4173;
const root = path.resolve(__dirname, '../..');
const runtimeDir = path.join(root, 'artifacts', 'demo-local');
const pidFile = path.join(runtimeDir, 'server.pid');
const statusFile = path.join(runtimeDir, 'server-status.json');
const wait = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

let items = [];
let nextItemId = 1;
let nextCommentId = 1;

function resetData() {
  nextItemId = 1;
  nextCommentId = 1;
  items = [{ id: nextItemId++, title: 'Welcome item', description: 'A deterministic starting point.', comments: [] }];
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function html() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TestGenerator Demo Portal</title><style>
  :root{font-family:Inter,system-ui,sans-serif;color:#172033;background:#f4f7fb}*{box-sizing:border-box}body{margin:0}nav{height:64px;background:#172033;color:white;display:flex;align-items:center;justify-content:space-between;padding:0 8vw}nav a{color:white;text-decoration:none}.brand{font-size:20px;font-weight:700}.user{color:#b9c7df}main{max-width:900px;margin:48px auto;padding:0 24px}.card{background:white;border:1px solid #dce3ee;border-radius:12px;padding:24px;box-shadow:0 8px 30px #26375012;margin-bottom:18px}h1{margin-top:0}label{display:block;font-weight:600;margin:14px 0 6px}input,textarea{width:100%;padding:11px;border:1px solid #b9c5d6;border-radius:7px;font:inherit}textarea{min-height:110px}.button,button{display:inline-block;border:0;border-radius:7px;background:#2864dc;color:white;padding:10px 16px;font-weight:650;text-decoration:none;cursor:pointer;margin:10px 8px 0 0}.danger{background:#b62f3a}.secondary{background:#53657d}.item-link{font-size:18px;color:#2459bd;font-weight:650;text-decoration:none}.muted{color:#637187}.error{color:#a51f2b;font-weight:650}.comments li{padding:10px 0;border-bottom:1px solid #e5eaf1}</style></head><body><nav><a class="brand" href="/items">TestGenerator Demo Portal</a><span id="identity" class="user"></span></nav><main id="app"></main><script>
  const app=document.querySelector('#app');const identity=document.querySelector('#identity');
  const user=()=>localStorage.getItem('demoUser');identity.textContent=user()?('Signed in as '+user()):'';
  const api=async(url,options={})=>{const response=await fetch(url,{headers:{'content-type':'application/json'},...options});let data={};try{data=await response.json()}catch{}return{response,data}};
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  async function render(){const pathname=location.pathname;if(pathname==='/login'){app.innerHTML='<section class="card"><h1>Sign in</h1><form id="login"><label for="email">Email</label><input id="email" name="email"><label for="password">Password</label><input id="password" name="password" type="password"><button>Sign in</button><p id="login-error" role="alert" class="error"></p></form></section>';document.querySelector('#login').onsubmit=async event=>{event.preventDefault();const body={email:event.target.email.value,password:event.target.password.value};const {response,data}=await api('/api/login',{method:'POST',body:JSON.stringify(body)});if(response.ok){localStorage.setItem('demoUser',data.name);location.href='/items'}else document.querySelector('#login-error').textContent=data.error};return}
  if(!user()){location.href='/login';return}identity.textContent='Signed in as '+user();
  if(pathname==='/items'){const {data}=await api('/api/items');app.innerHTML='<section><h1>Items</h1><a class="button" href="/items/new">Create item</a></section>'+data.map(item=>'<article class="card"><a class="item-link" href="/items/'+item.id+'">'+esc(item.title)+'</a><p class="muted">'+esc(item.description)+'</p></article>').join('');return}
  if(pathname==='/items/new'){renderForm('Create item',null);return}
  const parts=pathname.split('/').filter(Boolean);if(parts.length!==2||parts[0]!=='items'||!Number.isInteger(Number(parts[1]))){app.innerHTML='<h1>Not found</h1>';return}const {response,data:item}=await api('/api/items/'+parts[1]);if(!response.ok){app.innerHTML='<h1>Not found</h1>';return}renderDetail(item)}
  function renderForm(heading,item){app.innerHTML='<section class="card"><h1>'+heading+'</h1><form id="item-form"><label for="title">Title</label><input id="title" name="title" value="'+esc(item?.title||'')+'"><label for="description">Description</label><textarea id="description" name="description">'+esc(item?.description||'')+'</textarea><button>Save item</button></form></section>';document.querySelector('#item-form').onsubmit=async event=>{event.preventDefault();const body={title:event.target.title.value,description:event.target.description.value};const target=item?'/api/items/'+item.id:'/api/items';const {response,data}=await api(target,{method:item?'PUT':'POST',body:JSON.stringify(body)});if(response.ok)location.href='/items/'+data.id}}
  function renderDetail(item){app.innerHTML='<section class="card"><h2>Item details</h2><h1>'+esc(item.title)+'</h1><p>'+esc(item.description)+'</p><button id="edit" class="secondary">Edit item</button><button id="delete" class="danger">Delete item</button><p id="delete-error" role="alert" class="error"></p></section><section class="card"><h2>Comments</h2><form id="comment-form"><label for="comment">Comment</label><input id="comment" name="comment"><button>Add comment</button></form><ul class="comments">'+item.comments.map(comment=>'<li><span>'+esc(comment.body)+'</span> <button class="danger delete-comment" data-id="'+comment.id+'">Delete comment</button></li>').join('')+'</ul></section>';document.querySelector('#edit').onclick=()=>renderForm('Edit item',item);document.querySelector('#delete').onclick=async()=>{const {response,data}=await api('/api/items/'+item.id,{method:'DELETE'});if(response.ok)location.href='/items';else document.querySelector('#delete-error').textContent=data.error||'Delete failed'};document.querySelector('#comment-form').onsubmit=async event=>{event.preventDefault();const {response}=await api('/api/items/'+item.id+'/comments',{method:'POST',body:JSON.stringify({body:event.target.comment.value})});if(response.ok)render()};document.querySelectorAll('.delete-comment').forEach(button=>button.onclick=async()=>{const {response}=await api('/api/items/'+item.id+'/comments/'+button.dataset.id,{method:'DELETE'});if(response.ok)render()})}
  render();
  </script></body></html>`;
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  if (url.pathname === '/api/health') return sendJson(response, 200, { status: 'ready' });
  if (url.pathname === '/api/reset' && request.method === 'POST') { resetData(); return sendJson(response, 200, { status: 'reset' }); }
  if (url.pathname === '/api/login' && request.method === 'POST') {
    const body = await readJson(request);
    return typeof body.email === 'string' && body.email.endsWith('@demo.local') && typeof body.password === 'string' && body.password.length >= 8
      ? sendJson(response, 200, { token: 'local-demo-token', name: 'Demo User' })
      : sendJson(response, 401, { error: 'Invalid credentials' });
  }
  if (url.pathname === '/api/items' && request.method === 'GET') return sendJson(response, 200, items);
  if (url.pathname === '/api/items' && request.method === 'POST') {
    const body = await readJson(request); const item = { id: nextItemId++, title: body.title, description: body.description, comments: [] }; items.push(item); return sendJson(response, 201, item);
  }
  const commentMatch = url.pathname.match(/^\/api\/items\/(\d+)\/comments(?:\/(\d+))?$/);
  if (commentMatch) {
    const item = items.find(({ id }) => id === Number(commentMatch[1])); if (!item) return sendJson(response, 404, { error: 'Item not found' });
    if (request.method === 'POST' && !commentMatch[2]) { const body = await readJson(request); const comment = { id: nextCommentId++, body: body.body }; item.comments.push(comment); return sendJson(response, 201, comment); }
    if (request.method === 'DELETE' && commentMatch[2]) { item.comments = item.comments.filter(({ id }) => id !== Number(commentMatch[2])); return sendJson(response, 200, { deleted: true }); }
  }
  const itemMatch = url.pathname.match(/^\/api\/items\/(\d+)$/);
  if (itemMatch) {
    const id = Number(itemMatch[1]); const item = items.find((entry) => entry.id === id); if (!item) return sendJson(response, 404, { error: 'Item not found' });
    if (request.method === 'GET') return sendJson(response, 200, item);
    if (request.method === 'PUT') { const body = await readJson(request); item.title = body.title; item.description = body.description; return sendJson(response, 200, item); }
    if (request.method === 'DELETE') { items = items.filter((entry) => entry.id !== id); return sendJson(response, 200, { deleted: true }); }
  }
  if (!url.pathname.startsWith('/api/')) { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); return response.end(html()); }
  return sendJson(response, 404, { error: 'Not found' });
}

function serve() {
  resetData(); fs.mkdirSync(runtimeDir, { recursive: true });
  const server = http.createServer((request, response) => handle(request, response).catch((error) => sendJson(response, 500, { error: error.message })));
  server.on('error', (error) => { fs.writeFileSync(statusFile, JSON.stringify({ status: 'error', error: error.code || error.message })); process.exitCode = 1; });
  server.listen(PORT, HOST, () => { fs.writeFileSync(pidFile, String(process.pid)); fs.writeFileSync(statusFile, JSON.stringify({ status: 'ready', port: PORT })); console.log(`Demo local ready at http://${HOST}:${PORT}`); });
  const shutdown = () => server.close(() => process.exit(0)); process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

function start() {
  fs.mkdirSync(runtimeDir, { recursive: true });
  if (fs.existsSync(pidFile)) { try { process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 0); console.error('Demo local server is already running.'); return 1; } catch { fs.rmSync(pidFile, { force: true }); } }
  fs.rmSync(statusFile, { force: true });
  const child = spawn(process.execPath, [__filename, 'serve'], { cwd: root, detached: true, stdio: 'ignore' }); child.unref();
  for (let elapsed = 0; elapsed < 5000; elapsed += 100) { if (fs.existsSync(statusFile)) { const status = JSON.parse(fs.readFileSync(statusFile, 'utf8')); if (status.status === 'ready') { console.log(`Demo local started on http://${HOST}:${PORT}`); return 0; } console.error(`Demo local failed to start: ${status.error}`); return 1; } wait(100); }
  try { process.kill(child.pid); } catch {} console.error('Demo local failed to report readiness.'); return 1;
}

function stop() {
  if (!fs.existsSync(pidFile)) { console.log('Demo local is not running.'); return 0; }
  const pid = Number(fs.readFileSync(pidFile, 'utf8')); try { process.kill(pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  for (let elapsed = 0; elapsed < 3000; elapsed += 100) { try { process.kill(pid, 0); wait(100); } catch { break; } }
  fs.rmSync(pidFile, { force: true }); fs.rmSync(statusFile, { force: true }); console.log('Demo local stopped.'); return 0;
}

function preflight() {
  const request = http.get(`http://${HOST}:${PORT}/api/health`, (response) => { let body = ''; response.on('data', (chunk) => body += chunk); response.on('end', () => { const valid = response.statusCode === 200 && body.includes('ready'); console.log(valid ? 'Demo local preflight PASS.' : 'Demo local preflight FAIL.'); process.exitCode = valid ? 0 : 1; }); });
  request.setTimeout(3000, () => request.destroy(new Error('timeout'))); request.on('error', (error) => { console.error(`Demo local preflight FAIL: ${error.message}`); process.exitCode = 1; });
}

const mode = process.argv[2];
if (mode === 'serve') serve(); else if (mode === 'start') process.exitCode = start(); else if (mode === 'stop') process.exitCode = stop(); else if (mode === 'preflight') preflight(); else { console.error('Usage: demo-local-server.cjs <start|stop|preflight>'); process.exitCode = 1; }
