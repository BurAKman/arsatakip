// ARSA TAKIP · PIYASA BOTU (GitHub Actions'ta 15 dakikada bir calisir; bilgisayar acik/kapali fark etmez)
// Gorevleri:
//   1) 6 saatte bir: Binance'te en cok islem goren 50 coinin gecmis mumlariyla 4 strateji x yuzlerce ayari dener, ileri testle her stratejinin en iyi 5 ayarini secer (egitim)
//      Stratejiler: g1/g3 = tepe kirilimi (24 saat / 2-3 gun), d1/d3 = dipten donus (24 saat / 2-3 gun).
//      Her ayarda BTC trend filtresi de denenir: 0 = filtre yok, 1 = sadece BTC yukselis trendindeyken, 2 = sadece BTC dusus trendindeyken (BTC 4 saatlik, 50 mumluk ortalamaya gore)
//   2) her calismada: ~150 coini tarar, en iyi 5 ayardan herhangi birinin kuralina uyan her coini SANAL islem olarak acar
//   3) her calismada: acik sanal islemleri 15 dakikalik mumlarla sonuclandirir (once hedef mi, once zarar kes mi, sure mi doldu)
// Sonuclar Supabase'e yazilir (piyasa_bot, piyasa_sanal); Arsa Takip uygulamasi oradan okur.
// Gercek para ile HICBIR islem yapmaz. Sadece herkese acik piyasa verisi okur.
// Gerekli GitHub "secrets": SB_URL, SB_SERVICE_KEY, BOT_USER_ID   (kurulum: OKU-BENI-BOT.txt)

const SB = (process.env.SB_URL || "").replace(/\/+$/, ""), KEY = process.env.SB_KEY || process.env.SB_SERVICE_KEY, UID = process.env.USER_ID || process.env.BOT_USER_ID;
const BN = process.env.BINANCE_BASE || "https://data-api.binance.vision";
const EGITIM_SAAT = +(process.env.EGITIM_SAAT || 24), TARAMA_COIN = +(process.env.TARAMA_COIN || 150), EGITIM_COIN = 50;
if(!SB || !KEY || !UID){ console.error("SB_URL / SB_SERVICE_KEY / BOT_USER_ID eksik (GitHub > Settings > Secrets and variables > Actions)"); process.exit(1); }

const IZGARA = { hedefK:[.6, .8, 1, 1.3, 1.7], stopK:[.5, .7, 1, 1.4], rsiMax:[70, 80, 95], hk:[1, 1.5, 2.5], L:[1, 2, 4], dMin:[-1, .03], rj:[0, 1] };
const IZGARA_DIP = { rsiMin:[20, 25, 30, 35], dusK:[1.5, 2.5, 3.5], hedefK:[.6, .8, 1, 1.3], stopK:[.7, 1, 1.4], yesil:[0, 1], rj:[0, 1, 2] };
const H1 = { iv:"1h", H:24, Lb:12, olcek:8, tMin:.015, tMax:.15, sMin:.01, sMax:.08, gun:24, ms:3600000 }, H4 = { iv:"4h", H:18, Lb:21, olcek:12, tMin:.03, tMax:.35, sMin:.02, sMax:.15, gun:6, ms:4*3600000 };
const TF = { g1:{ ...H1, tip:"kir", ad:"Kırılım · 24 saat" }, g3:{ ...H4, tip:"kir", ad:"Kırılım · 2-3 gün" },
             d1:{ ...H1, tip:"dip", ad:"Dipten dönüş · 24 saat" }, d3:{ ...H4, tip:"dip", ad:"Dipten dönüş · 2-3 gün" } };
const ayarlar = T => { const S = [];
  if(T.tip === "kir"){ for(const a of IZGARA.hedefK) for(const b of IZGARA.stopK) for(const r of IZGARA.rsiMax) for(const h of IZGARA.hk) for(const L of IZGARA.L) for(const dm of IZGARA.dMin) for(const rj of IZGARA.rj) S.push({ hedefK:a, stopK:b, rsiMax:r, hk:h, L, dMin:dm, rj }); }
  else { const G = IZGARA_DIP; for(const r of G.rsiMin) for(const d of G.dusK) for(const a of G.hedefK) for(const b of G.stopK) for(const y of G.yesil) for(const rj of G.rj) S.push({ rsiMin:r, dusK:d, hedefK:a, stopK:b, yesil:y, rj, L:1 }); }
  return S; };
const ayarKimlik = (tf, P) => tf + ":" + Object.keys(P || {}).sort().map(k => k + "=" + P[k]).join(",");
const ayarAnahtar = (T, P) => T.tip === "kir" ? `${P.hedefK}|${P.stopK}|${P.L}` : `${P.rsiMin}|${P.dusK}|${P.stopK}`;
const HARIC = /^(USDC|FDUSD|TUSD|USDP|EUR|TRY|BUSD|DAI|PAXG|WBTC|USD1|BFUSD|XUSD|AEUR|EURI|UST|USTC)$/;
const bekle = ms => new Promise(r => setTimeout(r, ms));

/* ---------- yardimcilar ---------- */
async function jget(url, deneme = 3){ for(let i = 0; i < deneme; i++){ try{ const r = await fetch(url); if(r.status === 429 || r.status === 418){ await bekle(3000*(i + 1)); continue; } if(!r.ok) throw new Error(r.status + " " + url); return await r.json(); }catch(e){ if(i === deneme - 1) throw e; await bekle(800); } } }
async function havuz(L, n, f){ const R = []; let i = 0; await Promise.all(Array.from({ length:n }, async () => { while(i < L.length){ const j = i++; try{ R[j] = await f(L[j], j); }catch(e){ R[j] = null; } } })); return R; }
// eski tip service_role anahtari (eyJ...) hem apikey hem Authorization ister; yeni tip gizli anahtar (sb_secret_...) sadece apikey ile gider
const sbH = (ek = {}) => ({ apikey:KEY, ...(/^sb_secret_/.test(KEY) ? {} : { Authorization:"Bearer " + KEY }), "Content-Type":"application/json", ...ek });
async function sb(yol, yontem = "GET", govde, ek){ const r = await fetch(`${SB}/rest/v1/${yol}`, { method:yontem, headers:sbH(ek), body: govde ? JSON.stringify(govde) : undefined });
  if(!r.ok) throw new Error(`Supabase ${yontem} ${yol.split("?")[0]}: ${r.status} ${(await r.text()).slice(0, 300)}`); const t = await r.text(); return t ? JSON.parse(t) : null; }
async function klines(sem, iv, lim, bas){ const r = await jget(`${BN}/api/v3/klines?symbol=${sem}&interval=${iv}&limit=${lim}${bas ? "&startTime=" + bas : ""}`);
  const v = { t:[], o:[], h:[], l:[], c:[], v:[], kap:[] }; (r || []).forEach(x => { v.t.push(Math.round(x[0]/1000)); v.o.push(+x[1]); v.h.push(+x[2]); v.l.push(+x[3]); v.c.push(+x[4]); v.v.push(+x[7]); v.kap.push(+x[6]); }); return v; }
async function coinler(n){ const r = await jget(`${BN}/api/v3/ticker/24hr`);
  return r.filter(t => /USDT$/.test(t.symbol) && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol) && !HARIC.test(t.symbol.replace(/USDT$/, "")) && +t.quoteVolume > 1e6 && +t.count > 0)
    .map(t => ({ bn:t.symbol, kod:t.symbol.replace(/USDT$/, ""), d:+t.priceChangePercent, hacim:+t.quoteVolume })).sort((a, b) => b.hacim - a.hacim).slice(0, n); }
const kapaliMumlar = R => { const n = R.c.length, simdi = Date.now(); if(n && R.kap[n - 1] > simdi){ for(const a of ["t", "o", "h", "l", "c", "v", "kap"]) R[a] = R[a].slice(0, -1); } return R; };

/* ---------- gostergeler + simulasyon (uygulamadaki ile ayni kural) ---------- */
function rsi(c, n = 14){ const r = new Float64Array(c.length).fill(NaN); let g = 0, l = 0; for(let i = 1; i < c.length; i++){ const d = c[i] - c[i-1], u = Math.max(d, 0), z = Math.max(-d, 0);
  if(i <= n){ g += u; l += z; if(i === n){ g /= n; l /= n; r[i] = l === 0 ? 100 : 100 - 100/(1 + g/l); } } else { g = (g*(n-1) + u)/n; l = (l*(n-1) + z)/n; r[i] = l === 0 ? 100 : 100 - 100/(1 + g/l); } } return r; }
/* BTC trend: 4 saatlik kapanis 50 mumluk ustel ortalamanin ustunde = 1 (yukselis), altinda = 2 (dusus) */
async function rejimKur(){ const R = kapaliMumlar(await klines("BTCUSDT", "4h", 1000)), n = R.c.length, e = new Float64Array(n), k = 2/51; const t = R.t, r = new Uint8Array(n);
  for(let i = 0; i < n; i++){ e[i] = i ? R.c[i]*k + e[i-1]*(1 - k) : R.c[i]; r[i] = i < 50 ? 0 : R.c[i] > e[i] ? 1 : 2; }
  const at = tKapanis => { let lo = 0, hi = n - 1, j = -1; while(lo <= hi){ const m = (lo + hi) >> 1; if(t[m] + 14400 <= tKapanis){ j = m; lo = m + 1; } else hi = m - 1; } return j < 0 ? 0 : r[j]; };
  return { at, simdi:n ? r[n - 1] : 0, fark:n ? R.c[n - 1]/e[n - 1] - 1 : 0 }; }
function hazirla(R, Ls, RJ, ivSn){ const n = R.c.length, c = R.c, sd = new Float64Array(n).fill(NaN), lr = new Float64Array(n);
  for(let i = 1; i < n; i++) lr[i] = Math.log(c[i]/c[i-1]);
  for(let i = 61; i < n; i++){ let o = 0; for(let j = i - 59; j <= i; j++) o += lr[j]; o /= 60; let v = 0; for(let j = i - 59; j <= i; j++) v += (lr[j] - o)*(lr[j] - o); sd[i] = Math.sqrt(v/59); }
  const hi = {}, vo = {}; for(const L of Ls){ const a = new Float64Array(n).fill(NaN), b = new Float64Array(n).fill(NaN);
    for(let i = L; i < n; i++){ let m = -Infinity, s = 0; for(let j = i - L; j < i; j++){ if(R.h[j] > m) m = R.h[j]; s += R.v[j]; } a[i] = m; b[i] = s/L; } hi[L] = a; vo[L] = b; }
  const v3 = new Float64Array(n).fill(NaN); for(let i = 3; i < n; i++) v3[i] = (R.v[i] + R.v[i-1] + R.v[i-2])/3;
  const rj = new Uint8Array(n); if(RJ) for(let i = 0; i < n; i++) rj[i] = RJ.at(R.t[i] + ivSn);
  return { ...R, n, sd, hi, vo, v3, rj, rsi:rsi(c) }; }
const tumL = T => [...new Set([T.Lb, ...IZGARA.L.map(x => Math.round(T.Lb*x))])];
// giris kurali (egitimde ve canli taramada AYNI fonksiyon)
function giris(d, i, P, T){ const c = d.c[i], sd = d.sd[i]; if(!(sd > 0) || i < T.gun + 1) return false;
  if(P.rj === 1 && d.rj[i] !== 1) return false; if(P.rj === 2 && d.rj[i] !== 2) return false;
  if(T.tip === "dip"){ if(!(d.rsi[i] < P.rsiMin)) return false; const tepe = d.hi[T.Lb][i]; if(!(c <= tepe*(1 - P.dusK*sd*Math.sqrt(T.Lb)))) return false; if(P.yesil && !(c > d.o[i])) return false; return true; }
  const L = Math.round(T.Lb*P.L); if(!(c > d.hi[L][i])) return false; const hk = d.v3[i]/(d.vo[L][i] || 1e-12); if(hk < P.hk) return false; if(!(d.rsi[i] < P.rsiMax)) return false;
  const dd = c/d.c[i - T.gun] - 1; if(P.dMin > -1 && dd < P.dMin) return false; if(dd > .35) return false; return true; }
const seviye = (c, sd, P, T) => ({ hed:c*(1 + Math.min(T.tMax, Math.max(T.tMin, P.hedefK*sd*Math.sqrt(T.olcek)))), st:c*(1 - Math.min(T.sMax, Math.max(T.sMin, P.stopK*sd*Math.sqrt(T.olcek)))) });
function sim(D, P, T, masraf, tBol){ const out = { tr:{ n:0, kaz:0, top:0 }, te:{ n:0, kaz:0, top:0 } };
  for(const d of D){ let bos = 0;
    for(let i = 100; i < d.n - 1; i++){ if(i < bos) continue; if(!giris(d, i, P, T)) continue; const c = d.c[i], { hed, st } = seviye(c, d.sd[i], P, T);
      if(i + T.H > d.n - 1) break; let cik = null; const son = i + T.H;
      for(let j = i + 1; j <= son; j++){ if(d.l[j] <= st){ cik = st; bos = j; break; } if(d.h[j] >= hed){ cik = hed; bos = j; break; } }
      if(cik == null){ cik = d.c[son]; bos = son; }
      const net = (cik/c - 1)*100 - masraf, k = d.t[i] < tBol ? out.tr : out.te; k.n++; k.top += net; if(net > 0) k.kaz++; } }
  return out; }
function sinyal(d, P, T){ if(!d || d.n < 100 || !P) return null; const i = d.n - 1, c = d.c[i], ok = giris(d, i, P, T), { hed, st } = seviye(c, d.sd[i], P, T), L = Math.round(T.Lb*(P.L || 1));
  return { ok, c, sd:d.sd[i], rsi:d.rsi[i], hk:d.v3[i]/(d.vo[L]?.[i] || 1e-12), rj:d.rj[i], hed, st }; }

/* ---------- egitim ---------- */
async function egit(eski, masraf, RJ){
  const C = await coinler(EGITIM_COIN), yeni = { surum:(eski?.surum || 0) + 1, t:Date.now(), kaynak:"bot", gecmis:eski?.gecmis || [], masraf, rejim:RJ.simdi }, onb = {};
  for(const tf of Object.keys(TF)){ const T = TF[tf];
    const V = (await havuz(C, 6, async x => { const ka = x.bn + T.iv; onb[ka] = onb[ka] || klines(x.bn, T.iv, 1000).then(kapaliMumlar); const R = await onb[ka]; return R.c.length > 300 ? { ...hazirla(R, tumL(T), RJ, T.ms/1000), kod:x.kod } : null; })).filter(Boolean);
    let tMin = Infinity, tMax = -Infinity; V.forEach(d => { tMin = Math.min(tMin, d.t[0]); tMax = Math.max(tMax, d.t[d.n - 1]); }); const tBol = tMin + (tMax - tMin)*.65;
    const S = ayarlar(T).map(P => ({ P, ...sim(V, P, T, masraf, tBol) }));
    const oz = s => s && s.n ? { n:s.n, ort:s.top/s.n, isabet:s.kaz/s.n } : null, enAz = T.tip === "dip" ? 30 : 50;
    const gec = S.filter(s => s.tr.n >= enAz && s.te.n >= 15).sort((x, y) => (y.tr.top/y.tr.n - x.tr.top/x.tr.n) || (y.tr.n - x.tr.n)), en = gec[0] || null;
    const ilk5 = []; for(const g of gec){ if(ilk5.length >= 5) break; if(ilk5.some(x => ayarAnahtar(T, x.P) === ayarAnahtar(T, g.P))) continue; ilk5.push({ P:g.P, tr:oz(g.tr), te:oz(g.te) }); }
    const vars = T.tip === "kir" ? S.find(s => s.P.hedefK === 1 && s.P.stopK === .7 && s.P.rsiMax === 80 && s.P.hk === 1.5 && s.P.L === 2 && s.P.dMin === .03 && s.P.rj === 0) : null;
    yeni[tf] = { tip:T.tip, ad:T.ad, P:en?.P || null, ilk5, tr:oz(en?.tr), te:oz(en?.te), vars:{ tr:oz(vars?.tr), te:oz(vars?.te) }, kombi:S.length, gecerli:gec.length, coin:V.length, aralik:[tMin, tMax], tBol,
      aktif: !!(en && en.te.n >= 15 && en.te.top/en.te.n > .05) };
    console.log(`egitim ${tf} (${T.ad}): ${V.length} coin, ${S.length} ayar, gecerli ${gec.length}, en iyi ileri test ${yeni[tf].te ? yeni[tf].te.ort.toFixed(2) + "% (" + yeni[tf].te.n + ")" : "-"} ${yeni[tf].aktif ? "ACIK" : "KAPALI"}`); }
  const g = { surum:yeni.surum, t:yeni.t, rejim:RJ.simdi }; for(const tf of Object.keys(TF)){ g[tf] = yeni[tf]?.te; g[tf + "a"] = yeni[tf]?.aktif; }
  yeni.gecmis = yeni.gecmis.concat([g]).slice(-120);
  return yeni; }

/* ---------- tarama: kurala uyan her coin -> sanal islem ---------- */
async function tara(A, masraf, RJ){
  const C = await coinler(TARAMA_COIN), acik = await sb(`piyasa_sanal?user_id=eq.${UID}&durum=eq.acik&select=k,alt,ai,algo&limit=10000`), var_ = new Set(acik.map(o => `${o.k}|${o.alt}|${o.ai}`)), yeni = [];
  // ayni mumdan ikinci kez giris olmasin (onceki islem kapanmis olsa bile)
  const yakin = await sb(`piyasa_sanal?user_id=eq.${UID}&t=gte.${new Date(Date.now() - 3*86400000).toISOString()}&select=k,alt,ai,t&limit=20000`), mumVar = new Set(yakin.map(o => `${o.k}|${o.alt}|${o.ai}|${new Date(o.t).getTime()}`));
  const onb = {};
  for(const tf of Object.keys(TF)){ const T = TF[tf], AY = (A[tf]?.ilk5?.length ? A[tf].ilk5 : A[tf]?.P ? [{ P:A[tf].P }] : []).map((a, i) => ({ ...a, i })); if(!AY.length) continue;
    await havuz(C, 6, async x => { const ka = x.bn + T.iv; onb[ka] = onb[ka] || klines(x.bn, T.iv, 151).then(kapaliMumlar); const R = await onb[ka]; if(R.c.length < 100) return; const tGiris = R.kap[R.kap.length - 1];
      const d = hazirla(R, tumL(T), RJ, T.ms/1000);
      for(const a of AY){ const s = sinyal(d, a.P, T); if(!s?.ok) continue; const k = "KRIPTO:" + x.kod, an = `${k}|${tf}|${a.i}`; if(var_.has(an) || mumVar.has(`${an}|${tGiris}`)) continue; var_.add(an); mumVar.add(`${an}|${tGiris}`);
        yeni.push({ user_id:UID, k, alt:tf, ai:a.i, algo:A.surum, giris:s.c, hedef:s.hed, stop:s.st, t:new Date(tGiris).toISOString(), son:new Date(tGiris + T.H*T.ms).toISOString(),
          oz:{ alt:tf, tip:T.tip, pk:ayarKimlik(tf, a.P), rj:s.rj, pazar:"kripto", rsi:Math.round(s.rsi), hk:+(s.hk || 0).toFixed(2), kir:T.tip === "kir", deg:x.d, saat:+new Date(tGiris).toLocaleString("en-US", { timeZone:"Europe/Istanbul", hour:"numeric", hour12:false }) % 24, ih:null, bn:x.bn }, kaynak:"bot", durum:"acik" }); } }); }
  const eklenen = []; for(let i = 0; i < yeni.length; i += 200){ const r = await sb("piyasa_sanal", "POST", yeni.slice(i, i + 200), { Prefer:"return=representation" }); if(Array.isArray(r)) eklenen.push(...r); }
  return { taranan:C.length, yeni:yeni.length, eklenen }; }

/* ---------- sonuclandirma: 15 dakikalik mumlarla once hangisine degdi ---------- */
async function sonuclandir(masraf){
  const acik = await sb(`piyasa_sanal?user_id=eq.${UID}&durum=eq.acik&select=id,k,giris,hedef,stop,t,son,oz&order=t.asc&limit=3000`); let bitti = 0; const kapanan = {};
  await havuz(acik, 6, async o => { const bn = o.oz?.bn || o.k.replace("KRIPTO:", "") + "USDT", t0 = new Date(o.t).getTime(), son = new Date(o.son).getTime(); let s = null;
    const r = await jget(`${BN}/api/v3/klines?symbol=${bn}&interval=15m&startTime=${t0}&limit=1000`);
    for(const m of (r || [])){ const t = +m[0]; if(t >= son) break; if(+m[3] <= +o.stop){ s = { cikis:+o.stop, neden:"zarar kes", ct:t }; break; } if(+m[2] >= +o.hedef){ s = { cikis:+o.hedef, neden:"hedef", ct:t }; break; } }
    if(!s && Date.now() > son && r?.length){ const z = r.filter(m => +m[0] < son).pop() || r[r.length - 1]; s = { cikis:+z[4], neden:"süre doldu", ct:son }; }
    if(!s) return; const brut = (s.cikis/o.giris - 1)*100;
    const net = +(brut - masraf).toFixed(4); await sb(`piyasa_sanal?id=eq.${o.id}`, "PATCH", { durum:"kapali", cikis:s.cikis, neden:s.neden, ct:new Date(s.ct).toISOString(), net }, { Prefer:"return=minimal" }); kapanan[o.id] = { net, ct:s.ct, neden:s.neden }; bitti++; });
  return { acik:acik.length, bitti, kapanan }; }

/* ---------- SANAL KASA: 5.000 TL ile katlama kurallariyla (ayni anda en fazla 2 islem, islem basi %5 risk), 500 TL altina duserse yeni tur 5.000 TL ----------
   "disiplin": sadece programin ONERDIGI ayarla (ileri testte acik ya da canli kanitli); program "bekle" diyorsa nakitte bekler.
   "her"     : her surenin en iyi ayarina (ayar 1) her sinyalde girer. */
const KASA_BAS = 5000, KASA_RISK = 5, KASA_MAKS = 2, KASA_BATTI = 500;
// canli kanit: ayarin KENDISINE gore (surum/sira degil). Egitim ayni ayari tekrar secerse gecmis canli sonuclari birikmeye devam eder.
async function canliKanit(A){ const t0 = new Date(Date.now() - 45*86400000).toISOString();
  const L = await sb(`piyasa_sanal?user_id=eq.${UID}&durum=eq.kapali&t=gte.${t0}&select=alt,net,oz&limit=20000`), k = {};
  for(const tf of Object.keys(TF)){ let en = null; (A[tf]?.ilk5 || []).forEach((a, i) => { const pk = ayarKimlik(tf, a.P), X = L.filter(x => x.oz?.pk === pk), n = X.length, ort = n ? X.reduce((t, x) => t + +x.net, 0)/n : 0;
      a.canli = { n, ort:+ort.toFixed(3), isabet:n ? +(X.filter(x => +x.net > 0).length/n).toFixed(3) : null };
      if(n >= 30 && ort > .1 && (!en || ort > en.ort)) en = { i, n, ort }; }); if(en) k[tf] = en; }
  return k; }
function kasaYeni(){ return { tur:1, bas:KASA_BAS, bakiye:KASA_BAS, acik:[], turlar:[], egri:[{ t:Date.now(), b:KASA_BAS }], islem:0, kazan:0, tepe:KASA_BAS, maxDus:0 }; }
function kasaIsle(K, kapanan, adaylar){
  // 1) kapanan islemler
  const kal = []; for(const p of K.acik){ const c = kapanan[p.id]; if(!c){ kal.push(p); continue; } K.bakiye += p.para*c.net/100; K.islem++; (K.gecmis = K.gecmis || []).push({ id:p.id, k:p.k, alt:p.alt, ai:p.ai, para:p.para, net:c.net, kz:+(p.para*c.net/100).toFixed(2), neden:c.neden, t:p.t, ct:c.ct }); if(c.net > 0) K.kazan++; K.egri.push({ t:c.ct, b:+K.bakiye.toFixed(2) }); K.tepe = Math.max(K.tepe, K.bakiye); K.maxDus = Math.max(K.maxDus, 1 - K.bakiye/K.tepe); }
  K.acik = kal;
  // 2) batti mi? yeni tur
  if(K.bakiye < KASA_BATTI && !K.acik.length){ K.turlar.push({ tur:K.tur, bas:K.bas, son:+K.bakiye.toFixed(2), islem:K.islem, kazan:K.kazan, bitis:Date.now(), neden:"battı" }); K.tur++; K.bakiye = KASA_BAS; K.bas = KASA_BAS; K.islem = 0; K.kazan = 0; K.tepe = KASA_BAS; K.maxDus = 0; K.egri.push({ t:Date.now(), b:KASA_BAS, yeniTur:K.tur }); }
  // 3) yeni girisler
  for(const x of adaylar){ if(K.acik.length >= KASA_MAKS || K.acik.some(p => p.k === x.k)) continue; const kay = Math.max(.005, 1 - x.stop/x.giris) + .005, kullan = K.acik.reduce((t, p) => t + p.para, 0);
    const para = Math.min(K.bakiye - kullan, K.bakiye/KASA_MAKS, K.bakiye*KASA_RISK/100/kay); if(para < 10) continue; K.acik.push({ id:x.id, k:x.k, alt:x.alt, ai:x.ai, para:+para.toFixed(2), t:Date.now() }); }
  K.egri = K.egri.slice(-3000); K.gecmis = (K.gecmis || []).slice(-300); return K; }

/* ---------- ana akis ---------- */
(async () => {
  const bas = Date.now(), satir = (await sb(`piyasa_bot?user_id=eq.${UID}&select=*`))[0] || null, masraf = +(satir?.masraf ?? process.env.MASRAF ?? .5);
  let A = satir?.algo || null, egitildi = false;
  const RJ = await rejimKur().catch(() => ({ at:() => 0, simdi:0, fark:0 }));
  if(!A?.surum || !A.t || !A.d1 || Date.now() - A.t > EGITIM_SAAT*3600000 || process.env.ZORLA_EGIT === "1"){ A = await egit(A, masraf, RJ); egitildi = true; }
  const T1 = await tara(A, masraf, RJ), S1 = await sonuclandir(masraf);
  // sanal kasalar
  const kasa = satir?.kasa || {}, kanit = await canliKanit(A).catch(() => ({}));
  const sira = L => L.slice().sort((a, b) => +b.oz?.hk - +a.oz?.hk);
  const disiplinAday = sira(T1.eklenen.filter(x => { const k = kanit[x.alt]; return k ? x.ai === k.i : A[x.alt]?.aktif && x.ai === 0; }));
  const herAday = sira(T1.eklenen.filter(x => x.ai === 0));
  // kasadaki acik pozisyonlarin guncel durumu (ayni calismada acilip kapananlar dahil)
  const idler = [...new Set([...(kasa.disiplin?.acik || []), ...(kasa.her?.acik || [])].map(p => p.id))], kapanmis = {};
  for(let i = 0; i < idler.length; i += 100){ const L = await sb(`piyasa_sanal?id=in.(${idler.slice(i, i + 100).join(",")})&select=id,durum,net,ct,neden`); (L || []).forEach(x => { if(x.durum === "kapali") kapanmis[x.id] = { net:+x.net, ct:new Date(x.ct).getTime(), neden:x.neden }; }); }
  kasa.disiplin = kasaIsle(kasa.disiplin || kasaYeni(), kapanmis, disiplinAday); kasa.her = kasaIsle(kasa.her || kasaYeni(), kapanmis, herAday); kasa.kanit = kanit;
  const kayit = { user_id:UID, algo:A, kasa, son_tarama:new Date().toISOString(), ...(egitildi ? { son_egitim:new Date().toISOString() } : {}), durum:{ rejim:RJ.simdi, btcFark:+(RJ.fark*100).toFixed(2), acikStrateji:Object.keys(TF).filter(tf => A[tf]?.aktif || kanit[tf]), taranan:T1.taranan, yeni:T1.yeni, acik:S1.acik - S1.bitti, bitti:S1.bitti, sure:Math.round((Date.now() - bas)/1000), masraf } };
  await sb("piyasa_bot?on_conflict=user_id", "POST", kayit, { Prefer:"resolution=merge-duplicates,return=minimal" });
  console.log(`kasa: disiplinli tur ${kasa.disiplin.tur} ${Math.round(kasa.disiplin.bakiye)} TL (${kasa.disiplin.acik.length} acik) · her firsat tur ${kasa.her.tur} ${Math.round(kasa.her.bakiye)} TL (${kasa.her.acik.length} acik)`);
  console.log(`tamam: ${T1.taranan} coin tarandi, +${T1.yeni} yeni sanal islem, ${S1.bitti} sonuclandi, acik ${S1.acik - S1.bitti}, algoritma v${A.surum}${egitildi ? " (yeni egitildi)" : ""}, ${Math.round((Date.now() - bas)/1000)} sn`);
})().catch(e => { console.error("HATA:", e.message); process.exit(1); });
