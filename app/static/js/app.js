(function(){
  const ROOM = window.__ROOM__ || {code:"0000",lang:"tr",username:"guest"};
  const t = (tr,en) => (ROOM.lang === "tr" ? tr : en);
  const groups = [
    { key:"fruit", label:"🍓 "+t("Meyve","Fruit"), unit:"kg", items:[
      ["🍎 "+t("Elma","Apple"),"kg"],["🍐 "+t("Armut","Pear"),"kg"],["🍇 "+t("Üzüm","Grapes"),"kg"],
      ["🍉 "+t("Karpuz","Watermelon"),"kg"],["🍊 "+t("Portakal","Orange"),"kg"],["🍌 "+t("Muz","Banana"),"kg"],
      ["🍍 "+t("Ananas","Pineapple"),"kg"],["🍑 "+t("Şeftali","Peach"),"kg"],["🍓 "+t("Çilek","Strawberry"),"kg"]
    ]},
    { key:"veg", label:"🥒 "+t("Sebze","Vegetable"), unit:"kg", items:[
      ["🍅 "+t("Domates","Tomato"),"kg"],["🧅 "+t("Soğan","Onion"),"kg"],["🫑 "+t("Biber","Pepper"),"kg"],
      ["🥔 "+t("Patates","Potato"),"kg"],["🌽 "+t("Mısır (koçan)","Corn Cob"),"adet"],["🥬 "+t("Marul","Lettuce"),"adet"],
      ["🧄 "+t("Sarımsak","Garlic"),"adet"],["🍄 "+t("Mantar","Mushroom"),"kg"],["🥒 "+t("Salatalık","Cucumber"),"kg"]
    ]},
    { key:"drink", label:"🥤 "+t("İçecek","Drink"), unit:"lt", items:[
      ["💧 "+t("Su","Water"),"lt"],["🥤 "+t("Kola","Cola"),"lt"],["🥤 "+t("Ayran","Ayran"),"lt"],["🧃 "+t("Meyve Suyu","Juice"),"lt"]
    ]},
    { key:"tool", label:"🔧 "+t("Ekipman/Alet","Tools"), unit:"adet", items:[
      ["🍖 "+t("Mangal","Grill"),"adet"],["🍖 "+t("Izgara Teli","Grill Net"),"adet"],["🔪 "+t("Bıçak","Knife"),"adet"],
      ["🪵 "+t("Kesme Tahtası","Cutting Board"),"adet"],["🔥 "+t("Mangal Kömürü","Charcoal"),"adet"],["🧤 "+t("Maşa","Tongs"),"adet"]
    ]}
  ];

  const chips = document.getElementById("chips");
  const itemName = document.getElementById("itemName");
  const unitSel = document.getElementById("unit");
  const amount = document.getElementById("amount");
  const addBtn = document.getElementById("addBtn");
  const itemsEl = document.getElementById("items");

  groups.forEach(g => {
    const cat = document.createElement("div");
    cat.className = "chip";
    cat.textContent = g.label;
    chips.appendChild(cat);
    g.items.forEach(([name, defUnit]) => {
      const c = document.createElement("div");
      c.className = "chip";
      c.textContent = name;
      c.addEventListener("click", () => {
        itemName.value = name;
        unitSel.value = defUnit || g.unit;
        amount.value = (unitSel.value==="lt"||unitSel.value==="adet")?1:1;
      });
      chips.appendChild(c);
    });
  });

  document.querySelectorAll(".quickbtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      amount.value = btn.dataset.amt;
      if(itemName.value.trim()){ addItem(); }
    });
  });

  const storeKey = `piknik:${ROOM.code}`;
  const load = () => JSON.parse(localStorage.getItem(storeKey) || "[]" );
  const save = (arr) => localStorage.setItem(storeKey, JSON.stringify(arr));

  function normalizedName(s){ return s.toLowerCase().trim(); }

  function render(){
    const arr = load();
    itemsEl.innerHTML = "";
    arr.forEach((it, idx)=>{
      const row = document.createElement("div");
      row.className = "item";
      if (it.status === "brought") row.style.outline = "2px solid #22c55e";
      row.innerHTML = `
        <div><b>${it.name}</b> — ${it.amount} ${it.unit} <span class="tag">${it.category}</span> <span class="tag">@${it.owner}</span></div>
        <div>
          <button class="statbtn need">${t("Eksik","Needed")}</button>
          <button class="statbtn claim">${t("Ayrılan","Claimed")}</button>
          <button class="statbtn brought">${t("Getirildi","Brought")}</button>
          <button class="pill" data-del="1">🗑</button>
        </div>`;
      const [needBtn,claimBtn,brBtn]=row.querySelectorAll(".statbtn");
      const del=row.querySelector("[data-del]");
      needBtn.onclick=()=>updateStatus(idx,"need");
      claimBtn.onclick=()=>updateStatus(idx,"claim");
      brBtn.onclick=()=>updateStatus(idx,"brought");
      del.onclick=()=>removeItem(idx);
      itemsEl.appendChild(row);
    });
  }

  function addItem(){
    const name = itemName.value.trim();
    if(!name) return;
    const unit = unitSel.value;
    const amt = parseFloat(amount.value||"1");
    const arr = load();
    if(arr.some(x=> normalizedName(x.name)===normalizedName(name))){
      alert(t("Bu ürün zaten listede.","Item already exists.")); return;
    }
    let catLabel=t("Diğer","Other");
    groups.forEach(g=>{
      if(g.items.some(([n])=> normalizedName(n)===normalizedName(name))) catLabel=g.label;
    });
    arr.push({name,unit,amount:amt,owner:ROOM.username,category:catLabel,status:"need"});
    save(arr);
    itemName.value="";
    render();
  }

  function updateStatus(idx, status){
    const arr=load(); if(!arr[idx])return;
    arr[idx].status=status; save(arr); render();
  }
  function removeItem(idx){ const arr=load(); arr.splice(idx,1); save(arr); render(); }

  document.getElementById("addBtn").addEventListener("click", addItem);
  render();
})();
