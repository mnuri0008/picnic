
const $ = (q, el=document)=>el.querySelector(q);
const $$= (q, el=document)=>Array.from(el.querySelectorAll(q));

let FILTER='all', nickname='', STATE={users:[],online:[],items:[],categories:[],units:[],room:{},max_users:50};

// i18n
const I18N = {
  tr: {
    title: "NURI – Piknik",
    join: "Katıl",
    add: "Ekle",
    save: "Kaydet",
    all: "Tümü",
    needed: "Eksik",
    claimed: "Ayrılan",
    brought: "Getirildi",
    a2hs: "iOS: Paylaş → “Ana Ekrana Ekle” ile uygulama gibi kullan.",
    nick_ph: "Takma ad (örn: Ali)",
    item_ph: "Ürün adı (örn: Köfte)",
    amount_ph: "Miktar",
    event_date: "Piknik tarihi",
    locked: "Tarih kilitli (son 2 gün)"
  },
  en: {
    title: "NURI – Picnic",
    join: "Join",
    add: "Add",
    save: "Save",
    all: "All",
    needed: "Needed",
    claimed: "Claimed",
    brought: "Brought",
    a2hs: "iOS: Share → Add to Home Screen to install.",
    nick_ph: "Nickname (e.g., Ali)",
    item_ph: "Item name (e.g., Meatballs)",
    amount_ph: "Amount",
    event_date: "Picnic date",
    locked: "Date locked (last 2 days)"
  }
};
function t(key){ const lang=$('#lang').value||'tr'; return (I18N[lang]||I18N.tr)[key]||key; }
function applyI18n(){
  $$('[data-i18n]').forEach(el=> el.textContent = t(el.getAttribute('data-i18n')));
  $$('[data-i18n-ph]').forEach(el=> el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
}

const socket = io({ transports:['websocket'] });
socket.on('state', s=>{ STATE=s; render(); });
socket.on('hello', ()=>{});

function initials(name){ return (name||'?').trim().slice(0,1).toUpperCase(); }
function fmtAmount(a,u){ return `${a} ${u}`; }

function render(){
  applyI18n();
  const online = STATE.online||[];
  const total = (STATE.users||[]).length;
  $('#presence').textContent = `${online.length}/${STATE.max_users}`;
  // initials
  const initDiv = $('#initials'); initDiv.innerHTML='';
  online.forEach(n=>{
    const b=document.createElement('div'); b.className='initial'; b.textContent=initials(n); b.title=n; initDiv.appendChild(b);
  });
  // date
  const room = STATE.room||{};
  const locked = !!room.locked;
  $('#eventDate').value = room.event_date ? room.event_date.replace('Z','') : '';
  $('#eventDate').disabled = locked;
  $('#saveDate').disabled = locked;
  $('#lockInfo').textContent = locked ? t('locked') : '';
  // selects
  const catSel=$('#category'); catSel.innerHTML='';
  (STATE.categories||[]).forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; catSel.appendChild(o); });
  const unitSel=$('#unit'); unitSel.innerHTML='';
  (STATE.units||[]).forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; unitSel.appendChild(o); });
  // category chips
  const chips=$('#catChips'); chips.innerHTML='';
  (STATE.categories||[]).forEach(c=>{ const b=document.createElement('button'); b.className='chip'; b.dataset.f=c; b.textContent=c; b.onclick=()=>{ FILTER=c; render(); }; chips.appendChild(b); });
  // items
  const ul=$('#list'); ul.innerHTML='';
  (STATE.items||[]).filter(it=>{
    if(FILTER==='all') return true;
    if(['needed','claimed','brought'].includes(FILTER)) return it.status===FILTER;
    return it.category===FILTER;
  }).forEach(it=>{
    const li=document.createElement('li'); li.className='item';
    const badge = it.status==='brought'?'<span class="badge ok">'+t('brought')+'</span>':it.status==='claimed'?'<span class="badge warn">'+t('claimed')+'</span>':'<span class="badge need">'+t('needed')+'</span>';
    li.innerHTML = `
      <div class="left">
        <span class="title">${it.title} — <span class="meta">${fmtAmount(it.amount,it.unit)} • ${it.category}</span></span>
        <span class="meta">${it.who?('@'+it.who):''}</span>
      </div>
      <div class="right">${badge}<button class="del">Sil</button></div>`;
    li.addEventListener('click', async e=>{
      if(!nickname) return;
      if(e.detail===1){ setTimeout(async ()=>{ if(e.detail===1){ await fetch('/api/items/'+it.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'claimed', who:nickname})}); } }, 160); }
      if(e.detail===2){ await fetch('/api/items/'+it.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'brought', who:nickname})}); }
    });
    li.querySelector('.del').addEventListener('click', async e=>{ e.stopPropagation(); await fetch('/api/items/'+it.id,{method:'DELETE'}); });
    ul.appendChild(li);
  });
  // filter highlight
  $$('.chip').forEach(x=>x.classList.remove('active'));
  const activeBtn = $$('.chip').find(x=>x.dataset.f===FILTER || x.dataset.f===FILTER); if(activeBtn) activeBtn.classList.add('active');
}

document.addEventListener('DOMContentLoaded', async ()=>{
  applyI18n();
  $('#lang').addEventListener('change', render);

  // init state
  const cs = await (await fetch('/api/categories')).json();
  const items = await (await fetch('/api/items')).json();
  const room = await (await fetch('/api/room')).json();
  const usersResp = await (await fetch('/api/users')).json();
  STATE = {items:items.items||[], categories:cs.categories||[], units:cs.units||[], users:usersResp.users||[], room};
  render();

  $('#joinBtn').addEventListener('click', async ()=>{
    const name=$('#nick').value.trim(); if(!name) return;
    const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    const j=await r.json(); if(!r.ok){ alert(j.error||'join error'); return; }
    nickname=name; socket.emit('join',{name});
  });

  $('#addBtn').addEventListener('click', async ()=>{
    if(!nickname){ alert('Önce katıl / Join first'); return; }
    const title=$('#title').value.trim(); if(!title) return;
    const category=$('#category').value;
    const amount=parseFloat($('#amount').value||'0');
    const unit=$('#unit').value;
    await fetch('/api/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,category,amount,unit,who:nickname})});
    $('#title').value=''; $('#amount').value='';
  });

  $('#saveDate').addEventListener('click', async ()=>{
    const v=$('#eventDate').value; if(!v) return;
    const r=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_date:v})});
    const j=await r.json(); if(!r.ok){ alert(j.error||'date error'); return; }
  });

  // top status chips (state filters)
  $$('[data-f]').forEach(b=> b.addEventListener('click', ()=>{ FILTER=b.dataset.f; render(); }));
});
