// ARSA TAKIP · PIYASA BOTU (GitHub Actions'ta 15 dakikada bir calisir; bilgisayar acik/kapali fark etmez)
// Gorevleri:
//   1) 6 saatte bir: Binance'te en cok islem goren 50 coinin gecmis mumlariyla 1080 ayari dener, ileri testle en iyi 5 ayari secer (egitim)
//   2) her calismada: ~150 coini tarar, en iyi 5 ayardan herhangi birinin kuralina uyan her coini SANAL islem olarak acar
//   3) her calismada: acik sanal islemleri 15 dakikalik mumlarla sonuclandirir (once hedef mi, once zarar kes mi, sure mi doldu)
// Sonuclar Supabase'e yazilir (piyasa_bot, piyasa_sanal); Arsa Takip uygulamasi oradan okur.
// Gercek para ile HICBIR islem yapmaz. Sadece herkese acik piyasa verisi okur.
// Gerekli GitHub "secrets": SB_URL, SB_SERVICE_KEY, BOT_USER_ID   (kurulum: OKU-BENI-BOT.txt)

const SB = (process.env.SB_URL || "").replace(/\/+$/, ""), KEY = process.env.SB_KEY || process.env.SB_SERVICE_KEY, UID = process.env.USER_ID || process.env.BOT_USER_ID;
const BN = process.env.BINANCE_BASE || "https://data-api.binance.vision";
const EGITIM_SAAT = +(process.env.EGITIM_SAAT || 6), TARAMA_COIN = +(process.env.TARAMA_COIN || 150), EGITIM_COIN = 50;
if(!SB || !KEY || !UID){ console.error("SB_URL / SB_SERVICE_KEY / BOT_USER_ID eksik (GitHub > Settings > Secrets and variables > Actions)"); process.exit(1); }

const IZGARA = { hedefK:[.6, .8, 1, 1.3, 1.7], stopK:[.5, .7, 1, 1.4], rsiMax:[70, 80, 95], hk:[1, 1.5, 2.5], L:[1, 2, 4], dMin:[-1, .03] };
const TF = { g1:{ iv:"1h", ad:"Bugün (24 saat)", H:24, Lb:12, olcek:8, tMin:.015, tMax:.15, sMin:.01, sMax:.08, gun:24, ms:3600000 },
             g3:{ iv:"4h", ad:"2-3 gün", H:18, Lb:21, olcek:12, tMin:.03, tMax:.35, sMin:.02, sMax:.15, gun:6, ms:4*3600000 } };
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
function hazirla(R, Ls){ const n = R.c.length, c = R.c, sd = new Float64Array(n).fill(NaN), lr = new Float64Array(n);
  for(let i = 1; i < n; i++) lr[i] = Math.log(c[i]/c[i-1]);
  for(let i = 61; i < n; i++){ let o = 0; for(let j = i - 59; j <= i; j++) o += lr[j]; o /= 60; let v = 0; for(let j = i - 59; j <= i; j++) v += (lr[j] - o)*(lr[j] - o); sd[i] = Math.sqrt(v/59); }
  const hi = {}, vo = {}; for(const L of Ls){ const a = new Float64Array(n).fill(NaN), b = new Float64Array(n).fill(NaN);
    for(let i = L; i < n; i++){ let m = -Infinity, s = 0; for(let j = i - L; j < i; j++){ if(R.h[j] > m) m = R.h[j]; s += R.v[j]; } a[i] = m; b[i] = s/L; } hi[L] = a; vo[L] = b; }
  const v3 = new Float64Array(n).fill(NaN); for(let i = 3; i < n; i++) v3[i] = (R.v[i] + R.v[i-1] + R.v[i-2])/3;
  return { ...R, n, sd, hi, vo, v3, rsi:rsi(c) }; }
function sim(D, P, T, masraf, tBol){ const out = { tr:{ n:0, kaz:0, top:0 }, te:{ n:0, kaz:0, top:0 } }, L = Math.round(T.Lb*P.L);
  for(const d of D){ let bos = 0;
    for(let i = 100; i < d.n - 1; i++){ if(i < bos) continue; const c = d.c[i], sd = d.sd[i]; if(!(sd > 0)) continue;
      if(!(c > d.hi[L][i])) continue; const hk = d.v3[i]/(d.vo[L][i] || 1e-12); if(hk < P.hk) continue; if(!(d.rsi[i] < P.rsiMax)) continue;
      const dd = c/d.c[i - T.gun] - 1; if(P.dMin > -1 && dd < P.dMin) continue; if(dd > .35) continue;
      const hed = c*(1 + Math.min(T.tMax, Math.max(T.tMin, P.hedefK*sd*Math.sqrt(T.olcek)))), st = c*(1 - Math.min(T.sMax, Math.max(T.sMin, P.stopK*sd*Math.sqrt(T.olcek))));
      if(i + T.H > d.n - 1) break; let cik = null; const son = i + T.H;
      for(let j = i + 1; j <= son; j++){ if(d.l[j] <= st){ cik = st; bos = j; break; } if(d.h[j] >= hed){ cik = hed; bos = j; break; } }
      if(cik == null){ cik = d.c[son]; bos = son; }
      const net = (cik/c - 1)*100 - masraf, k = d.t[i] < tBol ? out.tr : out.te; k.n++; k.top += net; if(net > 0) k.kaz++; } }
  return out; }
function sinyal(R, P, T){ const n = R.c.length; if(n < 100 || !P) return null; const i = n - 1, c = R.c[i], L = Math.round(T.Lb*P.L);
  let hi = -Infinity, vs = 0; for(let j = i - L; j < i; j++){ hi = Math.max(hi, R.h[j]); vs += R.v[j]; } const hk = ((R.v[i] + R.v[i-1] + R.v[i-2])/3)/(vs/L || 1e-12);
  let o = 0; for(let j = i - 59; j <= i; j++) o += Math.log(R.c[j]/R.c[j-1]); o /= 60; let v = 0; for(let j = i - 59; j <= i; j++){ const x = Math.log(R.c[j]/R.c[j-1]) - o; v += x*x; } const sd = Math.sqrt(v/59);
  const r = rsi(R.c)[i], dd = c/R.c[i - T.gun] - 1, ok = c > hi && hk >= P.hk && r < P.rsiMax && (P.dMin <= -1 || dd >= P.dMin) && dd <= .35;
  return { ok, c, hk, rsi:r, dd, sd, hed:c*(1 + Math.min(T.tMax, Math.max(T.tMin, P.hedefK*sd*Math.sqrt(T.olcek)))), st:c*(1 - Math.min(T.sMax, Math.max(T.sMin, P.stopK*sd*Math.sqrt(T.olcek)))) }; }

/* ---------- egitim ---------- */
async function egit(eski, masraf){
  const C = await coinler(EGITIM_COIN), yeni = { surum:(eski?.surum || 0) + 1, t:Date.now(), kaynak:"bot", gecmis:eski?.gecmis || [], masraf };
  for(const tf of ["g1", "g3"]){ const T = TF[tf], Ls = [...new Set(IZGARA.L.map(x => Math.round(T.Lb*x)))];
    const V = (await havuz(C, 6, async x => { const R = kapaliMumlar(await klines(x.bn, T.iv, 1000)); return R.c.length > 300 ? { ...hazirla(R, Ls), kod:x.kod } : null; })).filter(Boolean);
    let tMin = Infinity, tMax = -Infinity; V.forEach(d => { tMin = Math.min(tMin, d.t[0]); tMax = Math.max(tMax, d.t[d.n - 1]); }); const tBol = tMin + (tMax - tMin)*.65;
    const S = []; for(const a of IZGARA.hedefK) for(const b of IZGARA.stopK) for(const r of IZGARA.rsiMax) for(const h of IZGARA.hk) for(const L of IZGARA.L) for(const dm of IZGARA.dMin){ const P = { hedefK:a, stopK:b, rsiMax:r, hk:h, L, dMin:dm }; S.push({ P, ...sim(V, P, T, masraf, tBol) }); }
    const oz = s => s && s.n ? { n:s.n, ort:s.top/s.n, isabet:s.kaz/s.n } : null;
    const gec = S.filter(s => s.tr.n >= 50 && s.te.n >= 15).sort((x, y) => (y.tr.top/y.tr.n - x.tr.top/x.tr.n) || (y.tr.n - x.tr.n)), en = gec[0] || null;
    const ilk5 = []; for(const g of gec){ if(ilk5.length >= 5) break; if(ilk5.some(x => x.P.hedefK === g.P.hedefK && x.P.stopK === g.P.stopK && x.P.L === g.P.L)) continue; ilk5.push({ P:g.P, tr:oz(g.tr), te:oz(g.te) }); }
    const vars = S.find(s => s.P.hedefK === 1 && s.P.stopK === .7 && s.P.rsiMax === 80 && s.P.hk === 1.5 && s.P.L === 2 && s.P.dMin === .03);
    yeni[tf] = { P:en?.P || null, ilk5, tr:oz(en?.tr), te:oz(en?.te), vars:{ tr:oz(vars?.tr), te:oz(vars?.te) }, kombi:S.length, gecerli:gec.length, coin:V.length, aralik:[tMin, tMax], tBol,
      aktif: !!(en && en.te.n >= 15 && en.te.top/en.te.n > .05) };
    console.log(`egitim ${tf}: ${V.length} coin, ${S.length} ayar, gecerli ${gec.length}, en iyi ileri test ${yeni[tf].te ? yeni[tf].te.ort.toFixed(2) + "% (" + yeni[tf].te.n + ")" : "-"} ${yeni[tf].aktif ? "ACIK" : "KAPALI"}`); }
  yeni.gecmis = yeni.gecmis.concat([{ surum:yeni.surum, t:yeni.t, g1:yeni.g1?.te, g3:yeni.g3?.te, g1a:yeni.g1?.aktif, g3a:yeni.g3?.aktif }]).slice(-120);
  return yeni; }

/* ---------- tarama: kurala uyan her coin -> sanal islem ---------- */
async function tara(A, masraf){
  const C = await coinler(TARAMA_COIN), acik = await sb(`piyasa_sanal?user_id=eq.${UID}&durum=eq.acik&select=k,alt,ai,algo&limit=10000`), var_ = new Set(acik.map(o => `${o.k}|${o.alt}|${o.ai}`)), yeni = [];
  // ayni mumdan ikinci kez giris olmasin (onceki islem kapanmis olsa bile)
  const yakin = await sb(`piyasa_sanal?user_id=eq.${UID}&t=gte.${new Date(Date.now() - 3*86400000).toISOString()}&select=k,alt,ai,t&limit=20000`), mumVar = new Set(yakin.map(o => `${o.k}|${o.alt}|${o.ai}|${new Date(o.t).getTime()}`));
  for(const tf of ["g1", "g3"]){ const T = TF[tf], AY = (A[tf]?.ilk5?.length ? A[tf].ilk5 : A[tf]?.P ? [{ P:A[tf].P }] : []).map((a, i) => ({ ...a, i })); if(!AY.length) continue;
    await havuz(C, 6, async x => { const R = kapaliMumlar(await klines(x.bn, T.iv, 151)); if(R.c.length < 100) return; const tGiris = R.kap[R.kap.length - 1];
      for(const a of AY){ const s = sinyal(R, a.P, T); if(!s?.ok) continue; const k = "KRIPTO:" + x.kod, an = `${k}|${tf}|${a.i}`; if(var_.has(an) || mumVar.has(`${an}|${tGiris}`)) continue; var_.add(an); mumVar.add(`${an}|${tGiris}`);
        yeni.push({ user_id:UID, k, alt:tf, ai:a.i, algo:A.surum, giris:s.c, hedef:s.hed, stop:s.st, t:new Date(tGiris).toISOString(), son:new Date(tGiris + T.H*T.ms).toISOString(),
          oz:{ alt:tf, pazar:"kripto", rsi:Math.round(s.rsi), hk:+s.hk.toFixed(2), kir:true, deg:x.d, saat:+new Date(tGiris).toLocaleString("en-US", { timeZone:"Europe/Istanbul", hour:"numeric", hour12:false }) % 24, ih:null, bn:x.bn }, kaynak:"bot", durum:"acik" }); } }); }
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
async function canliKanit(A){ const L = await sb(`piyasa_sanal?user_id=eq.${UID}&durum=eq.kapali&algo=eq.${A.surum}&select=alt,ai,net&limit=20000`), k = {};
  for(const tf of ["g1", "g3"]){ let en = null; for(let i = 0; i < 5; i++){ const X = L.filter(x => x.alt === tf && (x.ai ?? 0) === i), n = X.length, ort = n ? X.reduce((t, x) => t + +x.net, 0)/n : 0; if(n >= 30 && ort > .1 && (!en || ort > en.ort)) en = { i, n, ort }; } k[tf] = en; } return k; }
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
  if(!A?.surum || !A.t || Date.now() - A.t > EGITIM_SAAT*3600000 || process.env.ZORLA_EGIT === "1"){ A = await egit(A, masraf); egitildi = true; }
  const T1 = await tara(A, masraf), S1 = await sonuclandir(masraf);
  // sanal kasalar
  const kasa = satir?.kasa || {}, kanit = await canliKanit(A).catch(() => ({}));
  const sira = L => L.slice().sort((a, b) => +b.oz?.hk - +a.oz?.hk);
  const disiplinAday = sira(T1.eklenen.filter(x => { const k = kanit[x.alt]; return k ? x.ai === k.i : A[x.alt]?.aktif && x.ai === 0; }));
  const herAday = sira(T1.eklenen.filter(x => x.ai === 0));
  // kasadaki acik pozisyonlarin guncel durumu (ayni calismada acilip kapananlar dahil)
  const idler = [...new Set([...(kasa.disiplin?.acik || []), ...(kasa.her?.acik || [])].map(p => p.id))], kapanmis = {};
  for(let i = 0; i < idler.length; i += 100){ const L = await sb(`piyasa_sanal?id=in.(${idler.slice(i, i + 100).join(",")})&select=id,durum,net,ct,neden`); (L || []).forEach(x => { if(x.durum === "kapali") kapanmis[x.id] = { net:+x.net, ct:new Date(x.ct).getTime(), neden:x.neden }; }); }
  kasa.disiplin = kasaIsle(kasa.disiplin || kasaYeni(), kapanmis, disiplinAday); kasa.her = kasaIsle(kasa.her || kasaYeni(), kapanmis, herAday); kasa.kanit = kanit;
  const kayit = { user_id:UID, algo:A, kasa, son_tarama:new Date().toISOString(), ...(egitildi ? { son_egitim:new Date().toISOString() } : {}), durum:{ taranan:T1.taranan, yeni:T1.yeni, acik:S1.acik - S1.bitti, bitti:S1.bitti, sure:Math.round((Date.now() - bas)/1000), masraf } };
  await sb("piyasa_bot?on_conflict=user_id", "POST", kayit, { Prefer:"resolution=merge-duplicates,return=minimal" });
  console.log(`kasa: disiplinli tur ${kasa.disiplin.tur} ${Math.round(kasa.disiplin.bakiye)} TL (${kasa.disiplin.acik.length} acik) · her firsat tur ${kasa.her.tur} ${Math.round(kasa.her.bakiye)} TL (${kasa.her.acik.length} acik)`);
  console.log(`tamam: ${T1.taranan} coin tarandi, +${T1.yeni} yeni sanal islem, ${S1.bitti} sonuclandi, acik ${S1.acik - S1.bitti}, algoritma v${A.surum}${egitildi ? " (yeni egitildi)" : ""}, ${Math.round((Date.now() - bas)/1000)} sn`);
})().catch(e => { console.error("HATA:", e.message); process.exit(1); });
