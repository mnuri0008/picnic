
const $=(q,e=document)=>e.querySelector(q), $$=(q,e=document)=>Array.from(e.querySelectorAll(q));
let FILTER='all', nickname='', S=null, CURRENT_LANG=localStorage.getItem('lang')||'tr';

const I18N={
  tr:{join:'Katıl',add:'Ekle',save:'Kaydet',all:'Tümü',needed:'Eksik',claimed:'Ayrılan',brought:'Getirildi',delete:'Sil',
      nick_ph:'Takma ad (örn: Ali)',item_ph:'Ürün adı',amount_ph:'Miktar',event_date:'Piknik tarihi',
      date_note:'Değişiklik tüm kullanıcılara duyurulur.',confirm_date:'Tarihi değiştirmek istediğine emin misin?',
      quick_pick:'Hızlı seçim',must_join:'Önce katıl' },
  en:{join:'Join',add:'Add',save:'Save',all:'All',needed:'Needed',claimed:'Claimed',brought:'Brought',delete:'Delete',
      nick_ph:'Nickname (e.g., Ali)',item_ph:'Item name',amount_ph:'Amount',event_date:'Picnic date',
      date_note:'Change will notify everyone.',confirm_date:'Are you sure you want to change the date?',
      quick_pick:'Quick pick',must_join:'Join first'}
};
const CAT_LABEL={
  "Meyve":{tr:"Meyve",en:"Fruit"},"Sebze":{tr:"Sebze",en:"Vegetables"},"Et/Mangal":{tr:"Et/Mangal",en:"Meat/Grill"},
  "Deniz Ürünü":{tr:"Deniz Ürünü",en:"Seafood"},"Ekmek/Unlu":{tr:"Ekmek/Unlu",en:"Bread/Bakery"},
  "Peynir/Şarküteri":{tr:"Peynir/Şarküteri",en:"Cheese/Delicatessen"},"Salata/Meze":{tr:"Salata/Meze",en:"Salad/Meze"},
  "İçecek":{tr:"İçecek",en:"Drinks"},"Tatlı/Atıştırmalık":{tr:"Tatlı/Atıştırmalık",en:"Dessert/Snacks"},
  "Baharat/Çeşni":{tr:"Baharat/Çeşni",en:"Spices/Seasoning"},"Sos/Condiment":{tr:"Sos/Condiment",en:"Sauces/Condiments"},
  "Kahvaltılık":{tr:"Kahvaltılık",en:"Breakfast"},"Temizlik/Hijyen":{tr:"Temizlik/Hijyen",en:"Cleaning/Hygiene"},
  "Tek Kullanımlık":{tr:"Tek Kullanımlık",en:"Disposables"},"Soğutma/Buz":{tr:"Soğutma/Buz",en:"Cooling/Ice"},
  "Ekipman/Alet":{tr:"Ekipman/Alet",en:"Equipment/Tools"},"Oyun/Eğlence":{tr:"Oyun/Eğlence",en:"Games/Entertainment"},
  "Diğer":{tr:"Diğer",en:"Other"}
};
const ITEM_ICON={"Elma":"🍎","Armut":"🍐","Üzüm":"🍇","Karpuz":"🍉","Kavun":"🍈","Portakal":"🍊","Mandalina":"🍊","Çilek":"🍓","Muz":"🍌","Şeftali":"🍑","Elma Dilim":"🍎",
  "Domates":"🍅","Salatalık":"🥒","Biber":"🌶️","Soğan":"🧅","Mısır (koçan)":"🌽","Patates":"🥔","Marul":"🥬","Roka":"🥬","Mantar":"🍄",
  "Köfte":"🥙","Tavuk Kanat":"🍗","Tavuk Göğüs":"🍗","Sucuk":"🌭","Kuzu Pirzola":"🥩",
  "Levrek":"🐟","Çipura":"🐟","Somon":"🐟","Karides":"🦐",
  "Ekmek":"🥖","Lavaş":"🫓","Pide":"🫓","Simit":"🥯","Sandviç Ekmeği":"🍞",
  "Beyaz Peynir":"🧀","Kaşar":"🧀","Zeytin":"🫒","Salam":"🥓","Sosis":"🌭",
  "Çoban Salata":"🥗","Patates Salatası":"🥗","Humus":"🥙","Haydari":"🥣","Acılı Ezme":"🌶️",
  "Su":"💧","Ayran":"🥛","Kola":"🥤","Gazoz":"🥤","Meyve Suyu":"🧃","Çay":"🫖","Kahve":"☕","Maden Suyu":"💧",
  "Kurabiye":"🍪","Çikolata":"🍫","Cips":"🥔","Kek":"🍰","Lokum":"🍬",
  "Tuz":"🧂","Karabiber":"🧂","Pul Biber":"🌶️","Kimyon":"🧂","Kekik":"🌿","Nane":"🌿","Sumak":"🧂",
  "Ketçap":"🍅","Mayonez":"🧴","Hardal":"🟡","BBQ Sos":"🧴","Acı Sos":"🌶️","Zeytinyağı":"🫙","Nar Ekşisi":"🫙"};

function t(k){ return (I18N[CURRENT_LANG]||I18N.tr)[k] || k; }
function catLabel(c){ return (CAT_LABEL[c] && CAT_LABEL[c][CURRENT_LANG]) || c; }
function applyI18n(){
  $$('[data-i18n]').forEach(el=> el.textContent=t(el.getAttribute('data-i18n')));
  $$('[data-i18n-ph]').forEach(el=> el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph'))));
  $$('.langbtn').forEach(b=> b.classList.toggle('active', b.dataset.lang===CURRENT_LANG));
}
function bindLanguageToggle(){ $$('.langbtn').forEach(btn=>{ btn.addEventListener('click',()=>{ CURRENT_LANG = btn.dataset.lang || 'tr'; localStorage.setItem('lang', CURRENT_LANG); render(); }); }); }

function toDisplay(iso){ if(!iso) return ''; const d=new Date(iso); const pad=n=>String(n).padStart(2,'0'); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }

const socket=io({transports:['websocket']});
socket.on('state',s=>{ S=s; render(); });
socket.on('notify',n=>{ if(n.type==='date_changed'){ toast((CURRENT_LANG==='tr'?'Tarih güncellendi':'Date changed')); } });
function toast(m){const t=$('#toast'); t.textContent=m; t.hidden=false; setTimeout(()=>t.hidden=true,2500);}
function initials(n){return (n||'?').trim().slice(0,1).toUpperCase();}
function fmtAmount(a,u){return `${a} ${u}`;}

const KG_CATS=['Meyve','Sebze','Et/Mangal','Peynir/Şarküteri','Salata/Meze']; const LT_CATS=['İçecek','Sos/Condiment'];
async function tryAddQuick(){
  if(!nickname){ alert(t('must_join')); return; }
  const title=$('#title').value.trim(); const amount=parseFloat($('#amount').value||'0'); const unit=$('#unit').value; const category=$('#category').value;
  if(!title || !amount) return;
  await fetch('/api/items',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,category,amount,unit,who:nickname})});
  $('#title').value=''; $('#amount').value=''; render();
}
function renderQtyPresets(){
  const cat=$('#category').value; const div=$('#qtyPresets'); div.innerHTML=''; let unit='adet', presets=[];
  if(KG_CATS.includes(cat)){ unit='kg'; presets=[0.5,1,2,3,4,5]; } else if(LT_CATS.includes(cat)){ unit='lt'; presets=[0.5,1,1.5,2,5]; } else { unit='adet'; presets=[1,2,3,5,10,20]; }
  $('#unit').value=unit;
  presets.forEach(v=>{ const b=document.createElement('button'); b.type='button'; b.className='qbtn'; b.textContent=`${v} ${unit}`; b.onclick=()=>{ $('#amount').value=String(v); $('#unit').value=unit; tryAddQuick(); }; div.appendChild(b); });
}
function renderQuickGrid(){
  const grid=$('#quickGrid'); grid.innerHTML=''; const cat=$('#category').value; const items=(S.category_options||{})[cat]||[];
  const catIcon=(S.category_icons||{})[cat]||'•';
  const enMap=(S.option_en_map||{});
  items.forEach(x=>{
    const chip=document.createElement('button'); chip.type='button'; chip.className='qchip';
    const icon=ITEM_ICON[x] || catIcon;
    const label=(CURRENT_LANG==='en' && enMap[x])? enMap[x] : x;
    chip.innerHTML=`<span class="icon">${icon}</span><span>${label}</span>`;
    chip.onclick=()=>{ $('#title').value=x; $$('.qchip').forEach(c=>c.classList.remove('active')); chip.classList.add('active'); };
    grid.appendChild(chip);
  });
}
function render(){
  applyI18n(); if(!S) return;
  $('#presence').textContent = `${(S.online||[]).length}/${S.max_users}`;
  const catSel=$('#category'); catSel.innerHTML=''; (S.categories||[]).forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=`${(S.category_icons||{})[c]||''} ${catLabel(c)}`; catSel.appendChild(o); });
  const uSel=$('#unit'); uSel.innerHTML=''; (S.units||[]).forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; uSel.appendChild(o); });
  renderQuickGrid(); renderQtyPresets();
  const init=$('#initials'); init.innerHTML=''; (S.online||[]).forEach(n=>{ const d=document.createElement('div'); d.className='initial'; d.textContent=initials(n); d.title=n; init.appendChild(d); });
  const enMap=(S.option_en_map||{});
  const ul=$('#list'); ul.innerHTML=''; (S.items||[]).filter(it=>{ if(FILTER==='all') return true; if(['needed','claimed','brought'].includes(FILTER)) return it.status===FILTER; return it.category===FILTER; }).forEach(it=>{
    const li=document.createElement('li'); li.className='item';
    const titleLabel = (CURRENT_LANG==='en' && enMap[it.title]) ? enMap[it.title] : it.title;
    const badge = it.status==='brought'?`<span class="badge ok">${t('brought')}</span>`:it.status==='claimed'?`<span class="badge warn">${t('claimed')}</span>`:`<span class="badge need">${t('needed')}</span>`;
    li.innerHTML=`<div class="left"><span class="title">${titleLabel} — <span class="meta">${fmtAmount(it.amount,it.unit)} • ${catLabel(it.category)}</span></span><span class="meta">${it.who?('@'+it.who):''}</span></div><div class="right">${badge}
      <button class="sbtn need">${t('needed')}</button>
      <button class="sbtn claim">${t('claimed')}</button>
      <button class="sbtn ok">${t('brought')}</button>
      <button class="del">${t('delete')}</button></div>`;
    li.querySelector('.sbtn.need').addEventListener('click', async e=>{ e.stopPropagation(); await fetch('/api/items/'+it.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'needed'})}); });
    li.querySelector('.sbtn.claim').addEventListener('click', async e=>{ e.stopPropagation(); await fetch('/api/items/'+it.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'claimed'})}); });
    li.querySelector('.sbtn.ok').addEventListener('click', async e=>{ e.stopPropagation(); await fetch('/api/items/'+it.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'brought'})}); });
    li.querySelector('.del').addEventListener('click',async e=>{ e.stopPropagation(); await fetch('/api/items/'+it.id,{method:'DELETE'}); });
    ul.appendChild(li);
  });
  $$('.chip').forEach(x=>x.classList.remove('active')); const act=$$('.chip').find(x=>x.dataset.f===FILTER); if(act) act.classList.add('active');
  const ev=(S.room||{}).event_date; $('#eventDateText').value = toDisplay(ev);
}
document.addEventListener('DOMContentLoaded', async ()=>{
  bindLanguageToggle(); applyI18n();
  S = await (await fetch('/api/all')).json(); render();
  $('#category').addEventListener('change', ()=>{ renderQuickGrid(); renderQtyPresets(); });
  $('#joinBtn').addEventListener('click', async ()=>{ const name=$('#nick').value.trim(); if(!name) return; const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}); const j=await r.json(); if(!r.ok){ alert(j.error||'join error'); return; } nickname=name; socket.emit('join',{name}); });
  $('#addBtn').addEventListener('click', async ()=>{ await tryAddQuick(); });
  $('#saveDate').addEventListener('click', async ()=>{ const v=$('#eventDateText').value.trim(); if(!v) return; if(!confirm(t('confirm_date'))) return; await fetch('/api/date',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_date:v, who:nickname||'Anon'})}); });
  $$('[data-f]').forEach(b=> b.addEventListener('click',()=>{ FILTER=b.dataset.f; render(); }));
});
