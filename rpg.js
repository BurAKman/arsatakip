/* ===================== YARINSIZ ADAM · savas prototipi ===================== */
(function(){
"use strict";
const KOK = "yarinsiz-adam/";
/* ---- gorunus (sadece oyun acilinca eklenir) ---- */
if(!document.getElementById("yaStil")){
  const st = document.createElement("style"); st.id = "yaStil";
  st.textContent = `
.yaKap{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:300;background:#05040A;overflow:hidden;
  font-family:"Cinzel",Georgia,serif;color:#EDE6F7;user-select:none;-webkit-user-select:none;touch-action:none}
.yaKap.dondur{transform:rotate(90deg) translateY(-100%);transform-origin:top left}
.yaKap canvas{position:absolute;left:0;top:0;display:block}
.yaUst{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:14px;padding:10px 14px;z-index:3;
  background:linear-gradient(180deg,rgba(0,0,0,.6),transparent)}
.yaCik{width:34px;height:34px;border-radius:50%;cursor:pointer;color:#E8D8FF;background:rgba(10,6,20,.7);border:1px solid rgba(180,156,255,.5)}
.yaSira{display:flex;align-items:center;gap:8px;padding:4px 12px;background:rgba(10,6,20,.7);border:1px solid rgba(180,156,255,.35);
  clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 50%,calc(100% - 8px) 100%,8px 100%,0 50%)}
.yaSira span{font-size:10px;letter-spacing:.2em;color:#B8A8E8}
.yaSira i{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#8A1A2A,#2A0610);border:1px solid rgba(255,90,110,.5)}
.yaSira i.aktif{box-shadow:0 0 12px rgba(255,60,90,.8);border-color:#FFD0D8}
.yaBaslik{margin-left:auto;font-size:13px;letter-spacing:.34em;color:#D8C8F0;text-shadow:0 0 14px rgba(150,120,255,.6)}
.yaAltyazi{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);z-index:4;max-width:70%;text-align:center;
  font-family:Georgia,serif;font-size:clamp(14px,2.4vw,22px);line-height:1.45;color:#FFF;
  text-shadow:0 2px 8px #000,0 0 18px rgba(0,0,0,.9);pointer-events:none}
.yaAltyazi.yeni{animation:yaBelir .35s ease}
@keyframes yaBelir{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}
.yaKomut{position:absolute;left:14px;bottom:14px;z-index:3;display:grid;gap:6px;width:min(210px,24%)}
.yaKomut button{display:flex;flex-direction:column;align-items:flex-start;padding:8px 14px;cursor:pointer;text-align:left;
  color:#F2EAFF;background:linear-gradient(90deg,rgba(30,18,50,.92),rgba(10,6,20,.75));border:1px solid rgba(180,156,255,.35);
  border-left:3px solid #9A6BFF;clip-path:polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%)}
.yaKomut button b{font-size:14px;letter-spacing:.08em} .yaKomut button small{font-family:Georgia,serif;font-size:9.5px;color:#A89CC8}
.yaKomut button:active{filter:brightness(1.4)}
.yaKomut.kilit button{opacity:.4;pointer-events:none}
.yaYetenek{position:absolute;left:calc(min(210px,24%) + 24px);bottom:14px;z-index:4;width:min(430px,46%);display:none;padding:10px;
  background:linear-gradient(160deg,rgba(24,14,40,.96),rgba(8,4,16,.96));border:1px solid rgba(232,201,138,.55);
  box-shadow:0 10px 30px rgba(0,0,0,.7),inset 0 0 30px rgba(120,80,200,.15)}
.yaYetenek.acik{display:block;animation:yaBelir2 .25s ease}
@keyframes yaBelir2{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.yaYBas{text-align:center;font-size:15px;letter-spacing:.18em;color:#F0DCA8;margin-bottom:6px;text-shadow:0 0 10px rgba(232,201,138,.5)}
.yaYSatir{width:100%;display:flex;align-items:center;gap:10px;padding:6px 8px;margin-top:5px;cursor:pointer;text-align:left;color:#EDE6F7;
  background:linear-gradient(90deg,rgba(40,26,64,.8),rgba(12,8,22,.8));border:1px solid rgba(180,156,255,.3)}
.yaYSatir img{width:46px;height:46px;flex:0 0 auto}
.yaYSatir span{flex:1;min-width:0} .yaYSatir b{display:block;font-size:12.5px} .yaYSatir small{display:block;font-family:Georgia,serif;font-size:9.5px;color:#B8ACD8}
.yaYSatir em{font-style:normal;font-size:11px;color:#9CD8FF}
.yaYSatir.ulti{background:linear-gradient(90deg,rgba(110,10,24,.85),rgba(24,4,10,.85));border-color:rgba(255,80,100,.6)}
.yaYSatir.ulti em{color:#FF8A9A}
.yaYSatir:disabled{opacity:.38}
.yaDurum{position:absolute;right:14px;bottom:14px;z-index:3;width:min(270px,30%);padding:10px 12px;
  background:linear-gradient(160deg,rgba(24,14,40,.9),rgba(8,4,16,.9));border:1px solid rgba(180,156,255,.35)}
.yaAd{font-size:12px;letter-spacing:.16em;color:#F0DCA8;margin-bottom:6px} .yaAd small{font-size:9px;color:#FF8AA0;letter-spacing:.1em}
.yaBar{position:relative;height:14px;margin-top:5px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.1)}
.yaBar i{position:absolute;left:0;top:0;bottom:0;transition:width .4s ease}
.yaBar span{position:absolute;left:6px;top:50%;transform:translateY(-50%);font-size:9px;letter-spacing:.1em;text-shadow:0 1px 2px #000}
.yaBar b{font-size:10px}
.yaBar.can i{background:linear-gradient(90deg,#2E9E62,#9CF5C4)} .yaBar.sp i{background:linear-gradient(90deg,#3A5AC8,#9CD8FF)}
.yaBar.ulti i{background:linear-gradient(90deg,#8A0A1E,#FF5A6A)} .yaBar.ulti.dolu{box-shadow:0 0 12px rgba(255,60,80,.8);animation:yaNabiz 1s ease-in-out infinite}
@keyframes yaNabiz{50%{box-shadow:0 0 22px rgba(255,60,80,1)}}
.yaBoost{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px}
.yaBoost button{width:30px;height:26px;cursor:pointer;color:#F0DCA8;background:rgba(40,26,64,.8);border:1px solid rgba(232,201,138,.45)}
.yaBoost span{display:flex;gap:5px}
.yaBoost span i{width:12px;height:16px;background:rgba(255,255,255,.1);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
.yaBoost span i.var{background:linear-gradient(160deg,#FFE9A8,#C9973E)}
.yaBoost span i.boost{background:linear-gradient(160deg,#FFFFFF,#FF5A6A);box-shadow:0 0 8px #FF5A6A}
.yaAtla{position:absolute;right:14px;top:56px;z-index:5;display:none;padding:7px 14px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:.14em;
  color:#D8C8F0;background:rgba(10,6,20,.75);border:1px solid rgba(180,156,255,.4)}
.yaAtla.acik{display:block}`;
  document.head.appendChild(st);
}

const V = (typeof gv === "function") ? gv : (a=>a);
// dosya: once klasorunde, yoksa depo kokunde
const RES = {};
function res(yol){
  let im = RES[yol];
  if(!im){
    im = new Image(); im.dene = 0;
    const adaylar = [KOK + yol, yol.split("/").pop()];
    im.onerror = () => { im.dene++; if(im.dene < adaylar.length) im.src = V(adaylar[im.dene]); else im.hata = true; };
    im.onload = () => { im.alt = ayakBul(im); };
    im.src = V(adaylar[0]); RES[yol] = im;
  }
  return im.complete && im.naturalWidth ? im : null;
}
// gorselin ayak hizasi: alttan ilk dolu satir (bir kez hesaplanir)
function ayakBul(im){
  try{
    const c = document.createElement("canvas"), w = 96, h = 96;
    c.width = w; c.height = h; const x = c.getContext("2d");
    x.drawImage(im, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    for(let y = h-1; y >= 0; y--) for(let i = 0; i < w; i++) if(d[(y*w + i)*4 + 3] > 40) return (y+1)/h;
  }catch(e){}
  return .97;
}
function sesAc(ad){
  const a = new Audio(V(KOK + "replikler/" + ad)); let d = 0;
  a.onerror = () => { if(!d){ d = 1; a.src = V(ad); a.play().catch(()=>{}); } };
  return a;
}
let ALTYAZI = null;
function altyaziYukle(){
  const al = u => fetch(V(u)).then(r=>{ if(!r.ok) throw 0; return r.json(); });
  al(KOK + "replikler/yarinsiz-altyazi.json").catch(()=>al("yarinsiz-altyazi.json")).then(j=>ALTYAZI = j).catch(()=>{});
}

/* ---- pozlar ---- */
const P = n => "kahraman/yarinsiz-" + n + ".webp";
const U = n => "kahraman/s-craft/yarinsiz-" + n + ".webp";
const POZ = {
  bekle:["bekle-1","bekle-2","bekle-3","bekle-2"].map(P), gbekle:["gece-bekle-1","gece-bekle-2","gece-bekle-3","gece-bekle-4"].map(P),
  hazir:P("hazir"), hazir2:P("hazir-2"), savunma:P("savunma"), toparlan:P("toparlan"), zafer:P("zafer"),
  saldiri:["saldiri-1","saldiri-2","saldiri-3"].map(P), gsaldiri:["gece-saldiri-1","gece-saldiri-2","gece-saldiri-3","gece-saldiri-4"].map(P),
  gatilma:["gece-atilma-1","gece-atilma-2"].map(P), golge:["golgeadimi-1","golgeadimi-2","golgeadimi-3","golgeadimi-4"].map(P),
  kanli:["kanlikesis-1","kanlikesis-2","kanlikesis-3"].map(P), yuru:["yuru-1","yuru-2","yuru-3","yuru-4"].map(P),
  perde:P("geceperdesi"), hasar:[P("hasar-1"),P("hasar-2")], agir:P("hasar-agir"), bitkin:P("bitkin"),
  ulti:[1,2,3,4,5,6,7,8,9].map(i=>U("ulti-" + i)), kesme:U("ulti-kesme")
};
const YETENEK = [
  { id:"golge", ad:"Gölge Adımı", sp:12, ikon:"ikon/yarinsiz-ikon-golgeadimi.webp", tur:"Hançer", acik:"Hedefe anında sokulur, kaçınmayı artırır." },
  { id:"kanli", ad:"Kanlı Kesiş", sp:20, ikon:"ikon/yarinsiz-ikon-kanlikesis.webp", tur:"Hançer", acik:"Çift hançerle art arda ağır darbeler indirir." },
  { id:"perde", ad:"Gece Perdesi", sp:16, ikon:"ikon/yarinsiz-ikon-geceperdesi.webp", tur:"Karanlık", acik:"Kullanıcıyı güçlendirir, kritik gücünü yükseltir." },
  { id:"ulti", ad:"Mutlak Saldırı: Sessiz Kıyamet", sp:0, ikon:"ikon/yarinsiz-ikon-sessizkiyamet.webp", tur:"Mutlak", acik:"Ezici nihai darbe! Düşmanı patates eder…", ulti:true }
];

/* ---- durum ---- */
let S = null;
window.YarinsizBasla = function(){
  if(S) YarinsizKapat(true);
  altyaziYukle();
  Object.values(POZ).flat().forEach(res); res("harita/yarinsiz-harita-1.jpg"); YETENEK.forEach(y=>res(y.ikon));
  const k = document.createElement("div");
  k.className = "yaKap"; k.id = "yaKap";
  k.innerHTML = `
    <canvas id="yaTuval"></canvas>
    <div class="yaUst"><button class="yaCik" id="yaCik">✕</button>
      <div class="yaSira"><span>SIRA</span><i class="aktif"></i><i></i><i></i></div>
      <div class="yaBaslik">YARINSIZ ADAM</div></div>
    <div class="yaAltyazi" id="yaAltyazi"></div>
    <div class="yaKomut" id="yaKomut">
      <button data-k="saldir"><b>Saldır</b><small>Hançer</small></button>
      <button data-k="yetenek"><b>Yetenekler</b><small>SP harcar</small></button>
      <button data-k="savun"><b>Savun</b><small>Hasarı azaltır</small></button>
      <button data-k="konus"><b>Konuşma</b><small>Girişi tekrar oynat</small></button>
    </div>
    <div class="yaYetenek" id="yaYetenek"></div>
    <div class="yaDurum">
      <div class="yaAd">YARINSIZ ADAM <small id="yaMod"></small></div>
      <div class="yaBar can"><i id="yaCan"></i><span>HP <b id="yaCanY">1840</b></span></div>
      <div class="yaBar sp"><i id="yaSp"></i><span>SP <b id="yaSpY">120</b></span></div>
      <div class="yaBar ulti"><i id="yaUlti"></i><span>ULTİ</span></div>
      <div class="yaBoost"><button id="yaBoostEksi">◀</button><span id="yaBP"></span><button id="yaBoostArti">▶</button></div>
    </div>
    <button class="yaAtla" id="yaAtla">GEÇ ▸</button>`;
  document.body.appendChild(k);
  S = { kap:k, tv:k.querySelector("#yaTuval"), kare:0, zaman:0, t0:performance.now(),
    can:1840, canMax:1840, sp:120, spMax:120, ulti:100, bp:1, boost:0, gece:0, mesgul:false,
    anim:null, poz:null, x:0, hedefX:0, parca:[], efekt:[], sayi:[], iz:[], sarsinti:0, flas:null, kesme:null,
    kam:{ z:1, hz:1 }, altyazi:null };
  kapOlc(); [150, 500, 1000].forEach(ms=>setTimeout(kapOlc, ms));
  window.addEventListener("resize", kapOlc);
  try{ const f = document.documentElement.requestFullscreen?.(); if(f && f.then) f.then(()=>{ try{ screen.orientation?.lock?.("landscape")?.catch(()=>{}); }catch(e){} }).catch(()=>{}); }catch(e){}
  k.querySelector("#yaCik").onclick = () => YarinsizKapat();
  k.querySelectorAll(".yaKomut button").forEach(b=>b.onclick = () => komut(b.dataset.k));
  k.querySelector("#yaBoostArti").onclick = () => { if(S.boost < Math.min(3, S.bp)) S.boost++; ui(); };
  k.querySelector("#yaBoostEksi").onclick = () => { if(S.boost > 0) S.boost--; ui(); };
  yetenekMenu(); ui();
  S.raf = requestAnimationFrame(dongu);
  // ilk giris: karakter konusur
  setTimeout(()=>girisKonusma(), 900);
};
window.__yaTest = { eylem:(t)=>eylem(t), durum:()=>S };
window.YarinsizKapat = function(sessiz){
  if(!S) return;
  cancelAnimationFrame(S.raf); window.removeEventListener("resize", kapOlc);
  try{ S.ses?.pause(); }catch(e){}
  S.kap.remove(); S = null;
  try{ screen.orientation?.unlock?.(); if(document.fullscreenElement) document.exitFullscreen(); }catch(e){}
  if(!sessiz && typeof oyunlarEkran === "function") oyunlarEkran();
};
function kapOlc(){
  if(!S) return;
  const vv = window.visualViewport, vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
  const dik = vh > vw; S.kap.classList.toggle("dondur", dik);
  const w = dik ? vh : vw, h = dik ? vw : vh;
  S.kap.style.width = w + "px"; S.kap.style.height = h + "px";
  const dpr = Math.min(1.75, devicePixelRatio || 1);
  S.tv.width = Math.round(w*dpr); S.tv.height = Math.round(h*dpr);
  S.tv.style.width = w + "px"; S.tv.style.height = h + "px";
  S.bulanik = null;                         // derinlik katmani yeniden uretilsin
}

/* ---- arayuz ---- */
function yetenekMenu(){
  const m = S.kap.querySelector("#yaYetenek");
  m.innerHTML = `<div class="yaYBas">Yetenekler</div>` + YETENEK.map(y=>`
    <button class="yaYSatir ${y.ulti ? "ulti" : ""}" data-y="${y.id}">
      <img src="${V(KOK + y.ikon)}" onerror="this.onerror=null;this.src='${V(y.ikon.split("/").pop())}'" alt="">
      <span><b>${y.ad}</b><small>${y.acik}</small></span>
      <em>${y.ulti ? "ULTİ" : y.sp + " SP"}</em></button>`).join("");
  m.querySelectorAll("button").forEach(b=>b.onclick = () => { m.classList.remove("acik"); eylem(b.dataset.y); });
}
function ui(){
  if(!S) return;
  const q = id => S.kap.querySelector(id);
  q("#yaCan").style.width = (S.can/S.canMax*100) + "%"; q("#yaCanY").textContent = S.can;
  q("#yaSp").style.width = (S.sp/S.spMax*100) + "%"; q("#yaSpY").textContent = S.sp;
  q("#yaUlti").style.width = S.ulti + "%"; q(".yaBar.ulti").classList.toggle("dolu", S.ulti >= 100);
  q("#yaBP").innerHTML = Array.from({length:5},(_,i)=>`<i class="${i < S.bp ? "var" : ""} ${i < S.boost ? "boost" : ""}"></i>`).join("");
  q("#yaMod").textContent = S.gece ? `· GECE PERDESİ ${S.gece}` : "";
  S.kap.querySelectorAll(".yaYSatir").forEach(b=>{ const y = YETENEK.find(x=>x.id === b.dataset.y); if(!y) return;
    b.disabled = y.ulti ? S.ulti < 100 : S.sp < y.sp; });
  S.kap.querySelector("#yaKomut").classList.toggle("kilit", S.mesgul);
}
function komut(k){
  if(!S || S.mesgul) return;
  if(k === "yetenek") return S.kap.querySelector("#yaYetenek").classList.toggle("acik");
  S.kap.querySelector("#yaYetenek").classList.remove("acik");
  if(k === "konus") return girisKonusma(true);
  eylem(k === "saldir" ? "saldir" : "savun");
}
function altyazi(anahtar, ses){
  const k = S.kap.querySelector("#yaAltyazi");
  const satir = ALTYAZI?.[anahtar] || [];
  clearInterval(S.altSaat);
  if(!satir.length){ k.textContent = ""; return; }
  S.altSaat = setInterval(()=>{
    if(!S) return;
    const t = ses ? ses.currentTime : 0; let g = "";
    for(const [s2, m] of satir) if(t >= s2) g = m;
    if(ses && ses.ended) g = "";
    if(k.textContent !== g){ k.textContent = g; k.classList.remove("yeni"); void k.offsetWidth; if(g) k.classList.add("yeni"); }
    if(ses && ses.ended) clearInterval(S.altSaat);
  }, 120);
}
function soyle(dosya, anahtar){
  try{ S.ses?.pause(); }catch(e){}
  const a = sesAc(dosya); S.ses = a; a.play().catch(()=>{}); altyazi(anahtar, a);
  return new Promise(r=>{ a.onended = r; setTimeout(r, 17000); });
}
function girisKonusma(tekrar){
  if(!S || S.mesgul) return;
  S.mesgul = true; ui();
  const atla = S.kap.querySelector("#yaAtla"); atla.classList.add("acik");
  let bitti = false;
  const son = () => { if(bitti || !S) return; bitti = true; atla.classList.remove("acik");
    try{ S.ses?.pause(); }catch(e){} S.kap.querySelector("#yaAltyazi").textContent = ""; clearInterval(S.altSaat);
    S.poz = null; S.kam.hz = 1; S.mesgul = false; ui(); };
  atla.onclick = son;
  S.poz = POZ.hazir; S.kam.hz = 1.12;
  soyle("yarinsiz-konusma-giris.mp3", "yarinsiz-konusma-giris").then(son);
}

/* ---- animasyon yardimcilari ---- */
const bekle = ms => new Promise(r=>setTimeout(r, ms));
function oynat(kareler, ms, secenek){ return new Promise(r=>{ S.anim = { kareler, ms, bas:performance.now(), bitince:r, ...(secenek||{}) }; }); }
async function git(hedef, sure, kareler){
  const bas = S.x, t0 = performance.now();
  S.anim = { kareler, ms:90, bas:t0, dongu:true };
  await new Promise(r=>{ const f = () => { if(!S) return r(); const o = Math.min(1, (performance.now()-t0)/sure);
    S.x = bas + (hedef - bas) * (1 - Math.pow(1-o, 3)); if(o < 1) requestAnimationFrame(f); else r(); }; f(); });
  S.anim = null;
}
function hasarSayi(m, renk, kritik){
  S.sayi.push({ x:S.hedefX + (Math.random()-.5)*.08, y:.5 + Math.random()*.08, m, renk:renk || "#FFF", o:1.6, kritik, vy:-.004 });
}
function kesik(renk, genis, aci, cift){
  S.efekt.push({ t:"kesik", x:S.hedefX, y:.55, renk, genis:genis || .22, aci:aci ?? -.5, o:1, cift });
}
function kivilcim(adet, renk){
  const W = S.tv.width, H = S.tv.height;
  for(let i=0;i<adet;i++){ const a = Math.random()*Math.PI*2, v = (2 + Math.random()*7) * (W/1600);
    S.parca.push({ x:S.hedefX*W, y:.55*H, vx:Math.cos(a)*v, vy:Math.sin(a)*v - 2, o:1, r:(1.5 + Math.random()*3)*(W/1600), renk }); }
}
function sars(g){ S.sarsinti = Math.max(S.sarsinti, g); }
function flas(renk, o){ S.flas = { renk, o:o || .8 }; }

/* ---- eylemler ---- */
async function eylem(tip){
  if(!S || S.mesgul) return;
  const y = YETENEK.find(v=>v.id === tip);
  if(y && !y.ulti && S.sp < y.sp) return;
  if(y && y.ulti && S.ulti < 100) return;
  S.mesgul = true; ui();
  clearTimeout(S.bekci); S.bekci = setTimeout(()=>{ if(S && S.mesgul){ S.anim = null; S.poz = null; S.izAcik = false; S.kesme = null; S.karart = 0;
    S.x = .72; S.mesgul = false; ui(); } }, 20000);
  const vurus = 1 + S.boost, gc = S.gece > 0;
  S.bp = Math.max(0, S.bp - S.boost);
  if(y && !y.ulti) S.sp -= y.sp;
  const ev = S.x;
  try{
    if(tip === "saldir"){
      await git(.46, 360, gc ? POZ.gatilma : POZ.golge);
      for(let i=0;i<vurus;i++){
        await oynat(gc ? POZ.gsaldiri : POZ.saldiri, 85);
        kesik(gc ? "#B21E3C" : "#E8E8F0", .2, i%2 ? .6 : -.5); kivilcim(10, "#FFE9D0"); sars(6);
        hasarSayi(Math.round((gc ? 340 : 220) * (.9 + Math.random()*.2)), "#FFF");
        S.ulti = Math.min(100, S.ulti + 6);
      }
      S.poz = POZ.toparlan; await bekle(260);
    }
    else if(tip === "golge"){
      // hedefe goz acip kapayincaya kadar sokulur, arkasinda golge izleri
      S.izAcik = true;
      await git(.42, 180, POZ.golge);
      for(let i=0;i<vurus;i++){
        await oynat(POZ.golge, 55);
        kesik("#9A6BFF", .24, -.2 + i*.4); kivilcim(14, "#C8A8FF"); sars(8); flas("rgba(120,80,255,.35)");
        hasarSayi(Math.round(260 * (.9 + Math.random()*.2)), "#D6C8FF");
      }
      S.izAcik = false; S.ulti = Math.min(100, S.ulti + 10);
      S.poz = gc ? POZ.gbekle[0] : POZ.hazir2; await bekle(300);
    }
    else if(tip === "kanli"){
      await git(.45, 300, gc ? POZ.gatilma : POZ.golge);
      for(let i=0;i<vurus;i++){
        await oynat(POZ.kanli, 90);
        for(let j=0;j<3;j++){ kesik("#D1122E", .26 - j*.03, -.7 + j*.7, true); kivilcim(16, "#FF5A6A"); sars(11);
          hasarSayi(Math.round((gc ? 420 : 300) * (.9 + Math.random()*.2)), "#FF8A9A", j === 2); await bekle(110); }
      }
      flas("rgba(200,20,40,.35)");
      S.ulti = Math.min(100, S.ulti + 14);
      S.poz = POZ.toparlan; await bekle(320);
    }
    else if(tip === "perde"){
      S.poz = POZ.perde; S.kam.hz = 1.1;
      S.efekt.push({ t:"aura", o:1, r:0 });
      soyle("yarinsiz-replik-tehdit.mp3", "yarinsiz-replik-tehdit");
      await bekle(1700);
      S.gece = 3 + S.boost; flas("rgba(40,0,20,.6)", .9); sars(5);
      S.kam.hz = 1; await bekle(500);
    }
    else if(tip === "savun"){
      S.poz = POZ.savunma; await bekle(700);
    }
    else if(y && y.ulti){ await sessizKiyamet(); }
    if(S && S.x !== ev) await git(ev, 420, POZ.yuru);
  }catch(e){ console.log("yarinsiz", e); }
  if(!S) return;
  S.x = ev; S.poz = null;
  if(S.gece > 0 && tip !== "perde") S.gece--;
  S.boost = 0; S.bp = Math.min(5, S.bp + 1); S.mesgul = false; ui();
}

// Mutlak Saldiri: Sessiz Kiyamet
async function sessizKiyamet(){
  S.ulti = 0; ui();
  S.kam.hz = 1.18; S.karart = .75;
  S.poz = POZ.ulti[0];
  await soyle("yarinsiz-replik-sir.mp3", "yarinsiz-replik-sir");
  await oynat(POZ.ulti.slice(0, 3), 260);
  // kesme sahnesi
  S.kesme = { bas:performance.now(), sure:1900 };
  soyle("yarinsiz-replik-ulti.mp3", "yarinsiz-replik-ulti");
  await bekle(1900);
  S.kesme = null; flas("#FFFFFF", 1);
  await git(.44, 160, [POZ.ulti[3]]);
  for(let i=4;i<8;i++){
    S.poz = POZ.ulti[i];
    for(let j=0;j<3;j++){ kesik(j%2 ? "#FFFFFF" : "#E0102E", .34, Math.random()*2-1, true); kivilcim(22, j%2 ? "#FFF" : "#FF3A4A");
      hasarSayi(Math.round(999 + Math.random()*400), "#FF5A6A", true); sars(16); await bekle(85); }
  }
  flas("#FF2030", .9); sars(26);
  S.efekt.push({ t:"patlama", o:1, r:0 });
  hasarSayi(9999, "#FFE9A8", true);
  await bekle(600);
  S.poz = POZ.ulti[8]; S.x = .72; S.karart = 0; S.kam.hz = 1;
  await soyle("yarinsiz-replik-final.mp3", "yarinsiz-replik-final");
}

/* ---- ana dongu ---- */
function dongu(t){
  if(!S) return;
  try{ ciz(t); }catch(e){ if(!S.hataSay){ console.log("yarinsiz ciz", e); } S.hataSay = (S.hataSay || 0) + 1;
    try{ S.tv.getContext("2d").restore(); }catch(x){} }
  if(S) S.raf = requestAnimationFrame(dongu);
}
function ciz(t){
  S.kare++; const dt = Math.min(.05, (t - (S.son || t))/1000); S.son = t;
  const c = S.tv.getContext("2d"), W = S.tv.width, H = S.tv.height;
  if(!S.x) S.x = .72;
  S.hedefX = .27;
  S.kam.z += (S.kam.hz - S.kam.z) * .06;
  if(S.sarsinti > 0) S.sarsinti *= .86;
  const sx = (Math.random()-.5) * S.sarsinti * (W/1600), sy = (Math.random()-.5) * S.sarsinti * (W/1600);
  c.save();
  c.fillStyle = "#05040A"; c.fillRect(0,0,W,H);
  // kamera: karaktere dogru hafif yaklasma + yavas nefes
  const zz = S.kam.z * (1.04 + Math.sin(t/4000)*.006);
  const odakX = (S.x*.35 + .5*.65) * W, odakY = H*.62;
  c.translate(odakX + sx, odakY + sy); c.scale(zz, zz); c.translate(-odakX, -odakY);
  arkaPlan(c, W, H, t);
  // hedef isareti (dusman yokken)
  const hx = S.hedefX*W, gy = H*.8;
  c.save(); c.globalAlpha = .35 + Math.sin(t/500)*.1; c.strokeStyle = "#9A6BFF"; c.lineWidth = W*.002;
  c.beginPath(); c.ellipse(hx, gy, W*.06, H*.03, 0, 0, 7); c.stroke();
  c.beginPath(); c.ellipse(hx, gy, W*.035, H*.017, 0, 0, 7); c.stroke(); c.restore();
  // golge izleri
  if(S.izAcik && S.kare % 3 === 0){ const im = res(S.cizilen || POZ.hazir); if(im) S.iz.push({ x:S.x, im:golgeKopya(im), o:.5 }); }
  S.iz.forEach(z=>{ z.o -= .06; }); S.iz = S.iz.filter(z=>z.o > 0).slice(-6);
  S.iz.forEach(z=>karakterCiz(c, W, H, z.im, z.x, z.o, "hue"));
  // karakter
  const im = res(guncelPoz(t));
  if(im) karakterCiz(c, W, H, im, S.x, 1);
  efektler(c, W, H, dt);
  c.restore();
  // ekran uzeri: karartma, derinlik, vinyet, flas, kesme sahnesi
  if(S.karart){ c.fillStyle = `rgba(0,0,0,${S.karart*.6})`; c.fillRect(0,0,W,H); }
  if(S.gece){ const g = c.createRadialGradient(W/2,H/2,H*.2,W/2,H/2,H*.9); g.addColorStop(0,"rgba(60,0,30,0)"); g.addColorStop(1,"rgba(60,0,30,.45)"); c.fillStyle = g; c.fillRect(0,0,W,H); }
  const v = c.createRadialGradient(W/2,H*.55,H*.35,W/2,H*.55,W*.7); v.addColorStop(0,"rgba(0,0,0,0)"); v.addColorStop(1,"rgba(0,0,0,.62)");
  c.fillStyle = v; c.fillRect(0,0,W,H);
  if(S.flas){ c.globalAlpha = Math.max(0, S.flas.o); c.fillStyle = S.flas.renk; c.fillRect(0,0,W,H); c.globalAlpha = 1; S.flas.o -= .06; if(S.flas.o <= 0) S.flas = null; }
  if(S.kesme) kesmeCiz(c, W, H, t);
}
function guncelPoz(t){
  const A = S.anim;
  if(A){
    const i = Math.floor((t - A.bas) / A.ms);
    if(A.dongu) return (S.cizilen = A.kareler[i % A.kareler.length]);
    if(i >= A.kareler.length){ S.anim = null; const r = A.bitince; S.poz = A.kareler[A.kareler.length-1]; r && r(); return (S.cizilen = S.poz); }
    return (S.cizilen = A.kareler[i]);
  }
  if(S.poz) return (S.cizilen = S.poz);
  const set = S.gece ? POZ.gbekle : (S.can < S.canMax*.25 ? [POZ.bitkin] : POZ.bekle);
  return (S.cizilen = set[Math.floor(t/420) % set.length]);
}
// golge izi icin mor boyali kopya (her poz icin bir kez)
function golgeKopya(im){
  if(im.golge) return im.golge;
  const k = document.createElement("canvas"); k.width = 256; k.height = 256;
  const x = k.getContext("2d"); x.drawImage(im, 0, 0, 256, 256);
  x.globalCompositeOperation = "source-in"; x.fillStyle = "rgba(130,80,255,.9)"; x.fillRect(0, 0, 256, 256);
  k.alt = im.alt; k.naturalWidth = 256; im.golge = k; return k;
}
function karakterCiz(c, W, H, im, xOran, alfa, mod){
  const boy = H*.62, x = xOran*W, zemin = H*.83;
  const alt = im.alt || .97;
  c.save();
  // yumusak golge
  if(!mod){ c.globalAlpha = .45*alfa; c.fillStyle = "#000"; c.beginPath(); c.ellipse(x, zemin, boy*.17, boy*.035, 0, 0, 7); c.fill(); }
  c.globalAlpha = alfa;
  if(mod === "hue") c.globalCompositeOperation = "lighter";
  c.translate(x, zemin); c.scale(-1, 1);                 // sola bakmasi icin aynala
  c.drawImage(im, -boy/2, -boy*alt, boy, boy);
  c.restore();
}

/* ---- arka plan: harita + isik + derinlik bulanikligi ---- */
function arkaPlan(c, W, H, t){
  const im = res("harita/yarinsiz-harita-1.jpg");
  if(!im){ const g = c.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0A1030"); g.addColorStop(1,"#05040A"); c.fillStyle = g; c.fillRect(0,0,W,H); return; }
  const o = Math.max(W/im.naturalWidth, H/im.naturalHeight) * 1.06;
  const iw = im.naturalWidth*o, ih = im.naturalHeight*o;
  const ox = (W-iw)/2 + Math.sin(t/7000)*W*.006, oy = (H-ih)/2;
  c.drawImage(im, ox, oy, iw, ih);
  // derinlik bulanikligi: ust ve alt serit (bir kez uretilir)
  if(!S.bulanik || S.bulanik.w !== W){
    const b = document.createElement("canvas"); b.width = W; b.height = H; const bx = b.getContext("2d");
    try{ bx.filter = `blur(${Math.round(W/260)}px)`; }catch(e){}
    bx.drawImage(im, (W-iw)/2, oy, iw, ih); bx.filter = "none";
    bx.globalCompositeOperation = "destination-in";
    const g = bx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"rgba(0,0,0,1)"); g.addColorStop(.28,"rgba(0,0,0,0)"); g.addColorStop(.74,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,1)");
    bx.fillStyle = g; bx.fillRect(0,0,W,H);
    S.bulanik = { c:b, w:W };
  }
  c.drawImage(S.bulanik.c, Math.sin(t/7000)*W*.006, 0);
  // isik kaynaklari (haritadaki yerlerine gore)
  const isik = (px, py, r, renk, hz) => { const X = ox + px*iw, Y = oy + py*ih, R = r*W*(1 + Math.sin(t/hz)*.08);
    const g = c.createRadialGradient(X,Y,0,X,Y,R); g.addColorStop(0, renk); g.addColorStop(1,"rgba(0,0,0,0)");
    c.globalCompositeOperation = "lighter"; c.fillStyle = g; c.fillRect(X-R,Y-R,R*2,R*2); c.globalCompositeOperation = "source-over"; };
  isik(.33,.13,.07,"rgba(200,210,255,.35)", 3000);          // ay
  isik(.77,.17,.09,"rgba(120,110,255,.30)", 1300);          // run kapisi
  isik(.64,.42,.035,"rgba(150,120,255,.45)", 700);          // mangal
  isik(.89,.42,.035,"rgba(150,120,255,.45)", 800);
  isik(.12,.79,.05,"rgba(110,130,255,.45)", 600);           // on plan alevleri
  isik(.97,.8,.05,"rgba(110,130,255,.45)", 650);
  // havada suzulen isik tozlari
  if(S.kare % 5 === 0) S.parca.push({ x:Math.random()*W, y:H*(.5 + Math.random()*.5), vx:(Math.random()-.5)*.3*(W/1600), vy:-(.3 + Math.random()*.6)*(W/1600),
    o:.9, r:(1 + Math.random()*2.2)*(W/1600), renk:Math.random() < .7 ? "#A8B8FF" : "#E8D8FF", toz:true });
}
function efektler(c, W, H, dt){
  // aura
  S.efekt.forEach(e=>{
    if(e.t === "aura"){ e.r += .02; e.o -= .012; const X = S.x*W, Y = H*.6;
      c.globalCompositeOperation = "lighter"; const g = c.createRadialGradient(X,Y,0,X,Y,H*(.25 + e.r*.3));
      g.addColorStop(0,`rgba(200,20,50,${.5*e.o})`); g.addColorStop(1,"rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0,0,W,H);
      c.globalCompositeOperation = "source-over";
      if(Math.random() < .6) S.parca.push({ x:X + (Math.random()-.5)*H*.25, y:H*.8, vx:0, vy:-(2 + Math.random()*3)*(W/1600), o:1, r:3*(W/1600), renk:"#FF3A5A" }); }
    if(e.t === "kesik"){ e.o -= .06; const X = e.x*W, Y = e.y*H, R = e.genis*H;
      c.save(); c.translate(X, Y); c.rotate(e.aci); c.globalCompositeOperation = "lighter";
      const cizg = (kalin, renk, al) => { c.strokeStyle = renk; c.globalAlpha = Math.max(0, e.o*al); c.lineWidth = kalin; c.lineCap = "round";
        c.beginPath(); c.arc(0, 0, R, -Math.PI*.85, -Math.PI*.15); c.stroke(); };
      cizg(R*.16, e.renk, .5); cizg(R*.05, "#FFFFFF", 1);
      if(e.cift){ c.rotate(Math.PI*.5); cizg(R*.12, e.renk, .45); cizg(R*.04, "#FFFFFF", .9); }
      c.restore(); }
    if(e.t === "patlama"){ e.r += .05; e.o -= .02; const X = S.hedefX*W, Y = H*.55;
      c.save(); c.globalCompositeOperation = "lighter"; c.globalAlpha = Math.max(0, e.o);
      c.strokeStyle = "#FF3040"; c.lineWidth = W*.012; c.beginPath(); c.arc(X, Y, e.r*W*.5, 0, 7); c.stroke();
      c.strokeStyle = "#FFFFFF"; c.lineWidth = W*.003; c.beginPath(); c.arc(X, Y, e.r*W*.45, 0, 7); c.stroke(); c.restore(); }
  });
  S.efekt = S.efekt.filter(e=>e.o > 0);
  // parcaciklar
  c.globalCompositeOperation = "lighter";
  S.parca.forEach(p=>{ p.x += p.vx; p.y += p.vy; if(!p.toz) p.vy += .12*(W/1600); p.o -= p.toz ? .006 : .025;
    c.globalAlpha = Math.max(0, p.o); c.fillStyle = p.renk; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); });
  c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
  S.parca = S.parca.filter(p=>p.o > 0).slice(-220);
  // hasar sayilari
  S.sayi.forEach(n=>{ n.y += n.vy; n.o -= .018;
    c.globalAlpha = Math.max(0, Math.min(1, n.o)); const fs = (n.kritik ? .07 : .05)*H;
    c.font = `800 ${fs}px Cinzel, Georgia, serif`; c.textAlign = "center";
    c.lineWidth = fs*.12; c.strokeStyle = "rgba(0,0,0,.85)"; c.strokeText(n.m, n.x*W, n.y*H);
    c.fillStyle = n.renk; c.fillText(n.m, n.x*W, n.y*H); });
  c.globalAlpha = 1; S.sayi = S.sayi.filter(n=>n.o > 0);
}
// S-Craft kesme sahnesi: capraz bant, hiz cizgileri, gorsel kayarak girer
function kesmeCiz(c, W, H, t){
  const K = S.kesme, o = Math.min(1, (t - K.bas)/K.sure), gir = Math.min(1, o*4), cik = o > .85 ? (o-.85)/.15 : 0;
  c.save();
  c.fillStyle = `rgba(0,0,0,${.55*gir*(1-cik)})`; c.fillRect(0,0,W,H);
  c.translate(W/2, H/2); c.rotate(-.12);
  const bantY = H*.36*gir*(1-cik);
  c.fillStyle = "#1A0206"; c.fillRect(-W, -bantY, W*2, bantY*2);
  c.globalCompositeOperation = "lighter";
  for(let i=0;i<22;i++){ const y = ((i*97 + t*.9) % (bantY*2 || 1)) - bantY, x = ((i*331 + t*3.2) % (W*2)) - W;
    c.fillStyle = i%3 ? "rgba(255,40,60,.25)" : "rgba(255,255,255,.3)"; c.fillRect(x, y, W*.35, H*.004); }
  c.globalCompositeOperation = "source-over";
  const im = res(POZ.kesme);
  if(im && bantY > 2){
    const g2 = W*1.05, h2 = g2 * im.naturalHeight / im.naturalWidth;
    const kay = (1 - gir)*W*.6 - o*W*.06;
    c.save(); c.beginPath(); c.rect(-W, -bantY, W*2, bantY*2); c.clip();
    c.globalAlpha = 1 - cik; c.drawImage(im, -g2/2 + kay, -h2/2, g2, h2); c.restore();
  }
  c.strokeStyle = "rgba(255,60,80,.9)"; c.lineWidth = H*.006;
  c.beginPath(); c.moveTo(-W, -bantY); c.lineTo(W, -bantY); c.moveTo(-W, bantY); c.lineTo(W, bantY); c.stroke();
  c.restore();
}
})();
