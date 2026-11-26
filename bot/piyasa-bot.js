// ARSA TAKIP · PIYASA BOTU v2.4 (GitHub Actions'ta 15 dakikada bir calisir; bilgisayar acik/kapali fark etmez)
// v2: BIST (Yahoo gunluk mumlar, TradingView tarayicisindan likit hisse listesi) + 3 sanal kasa (Disiplinli / Piyango / Kumar)
//     Kumar = "indikator konseyi": TradingView'in klasik ucretsiz indikatorleri (EMA 9/21, EMA 50/200, MACD, RSI, Supertrend, UT Bot,
//     Squeeze Momentum, ADX/DMI, Bollinger %B, Ichimoku, hacim, goreli guc) + ogrenen model (lojistik regresyon): hangi indikator
//     ne zaman ise yariyor, gecmis kazanan/kaybeden islemlerden ogrenir; her gun yeniden egitilir, ileri testle olculur.
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
const YH = process.env.YAHOO_BASE || "https://query1.finance.yahoo.com", TVB = process.env.TV_BASE || "https://scanner.tradingview.com";
const MASRAF_BIST = +(process.env.MASRAF_BIST || .3);   // Midas BIST komisyonsuz; alis-satis makasi + kayma payi
const BAYAT_DK = +(process.env.BAYAT_DK || 40);
const EGITIM_SAAT = +(process.env.EGITIM_SAAT || 24), TARAMA_COIN = +(process.env.TARAMA_COIN || 150), EGITIM_COIN = 50;
if(!SB || !KEY || !UID){ console.error("SB_URL / SB_SERVICE_KEY / BOT_USER_ID eksik (GitHub > Settings > Secrets and variables > Actions)"); process.exit(1); }

const IZGARA = { hedefK:[.6, .8, 1, 1.3, 1.7], stopK:[.5, .7, 1, 1.4], rsiMax:[70, 80, 95], hk:[1, 1.5, 2.5], L:[1, 2, 4], dMin:[-1, .03], rj:[0, 1] };
const IZGARA_PG = { hedefK:[2, 3, 4.5, 6], stopK:[1, 1.5, 2], rsiMax:[85, 99], hk:[2, 3, 5], L:[1, 2, 4], dMin:[-1], rj:[0, 1] };   // piyango: buyuk hedef, hacim patlamasi, 1 hafta
const IZGARA_PGDIP = { rsiMin:[20, 25, 30], dusK:[1.5, 2.5, 3.5], hedefK:[1.5, 2, 3], stopK:[1, 1.5], yesil:[0, 1], rj:[0, 2] };   // v2.4 piyango-dip: ayi piyasasinda da calisir (sert dususten donus, buyuk hedef)
const IZGARA_DIP = { rsiMin:[20, 25, 30, 35], dusK:[1.5, 2.5, 3.5], hedefK:[.6, .8, 1, 1.3], stopK:[.7, 1, 1.4], yesil:[0, 1], rj:[0, 1, 2] };
const H1 = { iv:"1h", H:24, Lb:12, olcek:8, tMin:.015, tMax:.15, sMin:.01, sMax:.08, gun:24, ms:3600000 }, H4 = { iv:"4h", H:18, Lb:21, olcek:12, tMin:.03, tMax:.35, sMin:.02, sMax:.15, gun:6, ms:4*3600000 };
const TF = { g1:{ ...H1, tip:"kir", ad:"Kırılım · 24 saat" }, g3:{ ...H4, tip:"kir", ad:"Kırılım · 2-3 gün" },
             d1:{ ...H1, tip:"dip", ad:"Dipten dönüş · 24 saat" }, d3:{ ...H4, tip:"dip", ad:"Dipten dönüş · 2-3 gün" },
             p4:{ ...H4, tip:"pg", ad:"Piyango · 1 hafta", H:42, Lb:42, olcek:24, tMin:.08, tMax:1.2, sMin:.05, sMax:.25 },
             bp:{ pazar:"bist", iv:"1d", tip:"pg", ad:"Piyango · BIST 2 hafta", H:10, Lb:20, olcek:5, tMin:.06, tMax:.5, sMin:.04, sMax:.15, gun:5, ms:86400000 },
             pd:{ ...H4, tip:"dip", G:"pgdip", ck:true, ad:"Piyango · dipten dönüş (kripto)", H:42, Lb:42, olcek:24, tMin:.08, tMax:.6, sMin:.04, sMax:.15 },
             bd:{ pazar:"bist", iv:"1d", tip:"dip", G:"pgdip", ad:"Piyango · dipten dönüş (BIST)", H:10, Lb:20, olcek:5, tMin:.06, tMax:.4, sMin:.04, sMax:.12, gun:5, ms:86400000 } };
const PIYANGO = new Set(["p4", "bp", "pd", "bd"]);   // piyango kasasinin stratejileri (disiplinli kasaya girmez)
// v2.4 veri guvenligi: token bolunmesi / yeniden fiyatlama (ör. SNDKB 748 $ -> 81 $) ATR ve tepe hesabini bozar -> o coini atla
function sicrama(R, son = 200){ const c = R?.c || []; for(let j = Math.max(1, c.length - son); j < c.length; j++){ const r = c[j]/c[j-1]; if(!(r > 0) || r > 2.5 || r < .4) return true; } return false; }
const seviyeOk = (giris, hedef, stop, maks) => stop > 0 && stop < giris && hedef > giris && 1 - stop/giris <= maks;
const pazarOf = T => T.pazar || "kripto";
const ayarlar = T => { const S = [];
  if(T.tip === "pg"){ const G = IZGARA_PG; for(const a of G.hedefK) for(const b of G.stopK) for(const r of G.rsiMax) for(const h of G.hk) for(const L of G.L) for(const dm of G.dMin) for(const rj of G.rj) S.push({ hedefK:a, stopK:b, rsiMax:r, hk:h, L, dMin:dm, rj }); return S; }
  if(T.tip === "kir"){ for(const a of IZGARA.hedefK) for(const b of IZGARA.stopK) for(const r of IZGARA.rsiMax) for(const h of IZGARA.hk) for(const L of IZGARA.L) for(const dm of IZGARA.dMin) for(const rj of IZGARA.rj) S.push({ hedefK:a, stopK:b, rsiMax:r, hk:h, L, dMin:dm, rj }); }
  else { const G = T.G === "pgdip" ? IZGARA_PGDIP : IZGARA_DIP; for(const r of G.rsiMin) for(const d of G.dusK) for(const a of G.hedefK) for(const b of G.stopK) for(const y of G.yesil) for(const rj of G.rj) S.push({ rsiMin:r, dusK:d, hedefK:a, stopK:b, yesil:y, rj, L:1 }); }
  return S; };
const ayarKimlik = (tf, P) => tf + ":" + Object.keys(P || {}).sort().map(k => k + "=" + P[k]).join(",");
const ayarAnahtar = (T, P) => T.tip !== "dip" ? `${P.hedefK}|${P.stopK}|${P.L}` : `${P.rsiMin}|${P.dusK}|${P.stopK}`;
const HARIC = /^(USDC|FDUSD|TUSD|USDP|EUR|TRY|BUSD|DAI|PAXG|WBTC|USD1|BFUSD|XUSD|AEUR|EURI|UST|USTC)$/;
const bekle = ms => new Promise(r => setTimeout(r, ms));

/* ---------- yardimcilar ---------- */
async function jget(url, deneme = 3, opt){ for(let i = 0; i < deneme; i++){ try{ const r = await fetch(url, opt); if(r.status === 429 || r.status === 418){ await bekle(3000*(i + 1)); continue; } if(!r.ok) throw new Error(r.status + " " + url); return await r.json(); }catch(e){ if(i === deneme - 1) throw e; await bekle(800); } } }
async function havuz(L, n, f){ const R = []; let i = 0; await Promise.all(Array.from({ length:n }, async () => { while(i < L.length){ const j = i++; try{ R[j] = await f(L[j], j); }catch(e){ R[j] = null; } } })); return R; }
// eski tip service_role anahtari (eyJ...) hem apikey hem Authorization ister; yeni tip gizli anahtar (sb_secret_...) sadece apikey ile gider
const sbH = (ek = {}) => ({ apikey:KEY, ...(/^sb_secret_/.test(KEY) ? {} : { Authorization:"Bearer " + KEY }), "Content-Type":"application/json", ...ek });
async function sb(yol, yontem = "GET", govde, ek){ const r = await fetch(`${SB}/rest/v1/${yol}`, { method:yontem, headers:sbH(ek), body: govde ? JSON.stringify(govde) : undefined });
  if(!r.ok) throw new Error(`Supabase ${yontem} ${yol.split("?")[0]}: ${r.status} ${(await r.text()).slice(0, 300)}`); const t = await r.text(); return t ? JSON.parse(t) : null; }
// Supabase tek istekte en fazla 1000 satir doner -> hepsini sayfa sayfa cek
async function sbHepsi(yol){ const L = []; for(let o = 0; o < 200000; o += 1000){ const p = await sb(`${yol}&order=id.asc&limit=1000&offset=${o}`); if(!Array.isArray(p) || !p.length) break; L.push(...p); if(p.length < 1000) break; } return L; }
async function klines(sem, iv, lim, bas){ const r = await jget(`${BN}/api/v3/klines?symbol=${sem}&interval=${iv}&limit=${lim}${bas ? "&startTime=" + bas : ""}`);
  const v = { t:[], o:[], h:[], l:[], c:[], v:[], kap:[] }; (r || []).forEach(x => { v.t.push(Math.round(x[0]/1000)); v.o.push(+x[1]); v.h.push(+x[2]); v.l.push(+x[3]); v.c.push(+x[4]); v.v.push(+x[7]); v.kap.push(+x[6]); }); return v; }
async function coinler(n){ const r = await jget(`${BN}/api/v3/ticker/24hr`);
  return r.filter(t => /USDT$/.test(t.symbol) && !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol) && !HARIC.test(t.symbol.replace(/USDT$/, "")) && +t.quoteVolume > 1e6 && +t.count > 0)
    .map(t => ({ bn:t.symbol, kod:t.symbol.replace(/USDT$/, ""), d:+t.priceChangePercent, hacim:+t.quoteVolume })).sort((a, b) => b.hacim - a.hacim).slice(0, n); }
const UA = { headers:{ "User-Agent":"Mozilla/5.0 (X11; Linux x86_64) ArsaTakipBot/2.0", Accept:"application/json" } };
async function yahoo(sem, iv, aralik, p1){ const q = p1 ? `period1=${Math.floor(p1/1000)}&period2=${Math.floor(Date.now()/1000) + 3600}` : `range=${aralik}`;
  const r = await jget(`${YH}/v8/finance/chart/${encodeURIComponent(sem)}?interval=${iv}&${q}&includePrePost=false`, 3, UA), x = r?.chart?.result?.[0];
  if(!x?.timestamp) throw new Error("yahoo veri yok " + sem); const Q = x.indicators.quote[0], kapEk = iv === "1d" ? 8.5*3600000 : 3600000, v = { t:[], o:[], h:[], l:[], c:[], v:[], kap:[] };
  x.timestamp.forEach((t, i) => { if(Q.close[i] == null || Q.high[i] == null || Q.low[i] == null) return; v.t.push(t); v.o.push(+Q.open[i] || +Q.close[i]); v.h.push(+Q.high[i]); v.l.push(+Q.low[i]); v.c.push(+Q.close[i]); v.v.push(+(Q.volume[i] || 0)*+Q.close[i]); v.kap.push(t*1000 + kapEk); });
  return v; }
const BIST_YEDEK = ["THYAO","ASELS","GARAN","AKBNK","YKBNK","ISCTR","KCHOL","SAHOL","BIMAS","TUPRS","EREGL","FROTO","TOASO","SISE","TCELL","TTKOM","PGSUS","TAVHL","KRDMD","PETKM","SASA","HEKTS","ARCLK","VESTL","ENKAI","EKGYO","ALARK","MGROS","SOKM","ULKER","AEFES","CCOLA","TTRAK","DOAS","OTKAR","KONTR","ASTOR","SMRTG","ODAS","GUBRF","AKSEN","ENJSA","OYAKC","CIMSA","TSKB","HALKB","VAKBN","DOHOL","TKFEN","MAVI","BRSAN","ISMEN","AGHOL","AKSA","ZOREN","KARSN","EGEEN","TABGD","TURSG","CANTE"];
let BIST_ONB = null;
async function bistListe(n = 80){ if(BIST_ONB) return BIST_ONB;
  try{ const r = await fetch(`${TVB}/turkey/scan`, { method:"POST", headers:{ "Content-Type":"application/json", ...UA.headers }, body:JSON.stringify({ filter:[{ left:"type", operation:"equal", right:"stock" }, { left:"Value.Traded", operation:"greater", right:2e7 }], markets:["turkey"],
      columns:["name", "close", "Value.Traded", "change", "market_cap_basic", "price_earnings_ttm"], sort:{ sortBy:"Value.Traded", sortOrder:"desc" }, range:[0, n] }) });
    const j = await r.json(), L = (j?.data || []).map(x => ({ kod:x.d[0], bn:x.d[0] + ".IS", d:+x.d[3] || 0, hacim:+x.d[2] || 0, fk:x.d[5] })).filter(x => /^[A-Z0-9]{3,6}$/.test(x.kod));
    if(L.length >= 20) return BIST_ONB = L; }catch(e){ console.log("tradingview listesi alinamadi, yedek liste:", e.message); }
  return BIST_ONB = BIST_YEDEK.map(k => ({ kod:k, bn:k + ".IS", d:0, hacim:0 })); }
async function mumlar(T, x, n){ if(pazarOf(T) === "kripto") return kapaliMumlar(await klines(x.bn, T.iv, n));
  const R = kapaliMumlar(await yahoo(x.bn, T.iv === "1d" ? "1d" : "60m", T.iv === "1d" ? (n > 300 ? "5y" : "1y") : "1y")); if(R.c.length > n) for(const a of ["t", "o", "h", "l", "c", "v", "kap"]) R[a] = R[a].slice(-n); return R; }
const kapaliMumlar = R => { const n = R.c.length, simdi = Date.now(); if(n && R.kap[n - 1] > simdi){ for(const a of ["t", "o", "h", "l", "c", "v", "kap"]) R[a] = R[a].slice(0, -1); } return R; };

/* ---------- gostergeler + simulasyon (uygulamadaki ile ayni kural) ---------- */
function rsi(c, n = 14){ const r = new Float64Array(c.length).fill(NaN); let g = 0, l = 0; for(let i = 1; i < c.length; i++){ const d = c[i] - c[i-1], u = Math.max(d, 0), z = Math.max(-d, 0);
  if(i <= n){ g += u; l += z; if(i === n){ g /= n; l /= n; r[i] = l === 0 ? 100 : 100 - 100/(1 + g/l); } } else { g = (g*(n-1) + u)/n; l = (l*(n-1) + z)/n; r[i] = l === 0 ? 100 : 100 - 100/(1 + g/l); } } return r; }
/* BTC trend: 4 saatlik kapanis 50 mumluk ustel ortalamanin ustunde = 1 (yukselis), altinda = 2 (dusus) */
async function rejimKur(){ const R = kapaliMumlar(await klines("BTCUSDT", "4h", 1000)), n = R.c.length, e = new Float64Array(n), k = 2/51; const t = R.t, r = new Uint8Array(n);
  for(let i = 0; i < n; i++){ e[i] = i ? R.c[i]*k + e[i-1]*(1 - k) : R.c[i]; r[i] = i < 50 ? 0 : R.c[i] > e[i] ? 1 : 2; }
  const at = tKapanis => { let lo = 0, hi = n - 1, j = -1; while(lo <= hi){ const m = (lo + hi) >> 1; if(t[m] + 14400 <= tKapanis){ j = m; lo = m + 1; } else hi = m - 1; } return j < 0 ? 0 : r[j]; };
  return { at, simdi:n ? r[n - 1] : 0, fark:n ? R.c[n - 1]/e[n - 1] - 1 : 0 }; }
// BIST rejimi: XU100 gunluk kapanis 50 gunluk ustel ortalamanin ustunde = 1, altinda = 2
async function rejimBist(){ const R = kapaliMumlar(await yahoo("XU100.IS", "1d", "5y")), n = R.c.length, e = new Float64Array(n), k = 2/51, r = new Uint8Array(n);
  for(let i = 0; i < n; i++){ e[i] = i ? R.c[i]*k + e[i-1]*(1 - k) : R.c[i]; r[i] = i < 50 ? 0 : R.c[i] > e[i] ? 1 : 2; }
  const at = tKap => { let lo = 0, hi = n - 1, j = -1; while(lo <= hi){ const m = (lo + hi) >> 1; if(R.kap[m] <= tKap*1000){ j = m; lo = m + 1; } else hi = m - 1; } return j < 0 ? 0 : r[j]; };
  return { at, simdi:n ? r[n - 1] : 0, fark:n ? R.c[n - 1]/e[n - 1] - 1 : 0, R }; }
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
  const dd = c/d.c[i - T.gun] - 1; if(P.dMin > -1 && dd < P.dMin) return false; if(dd > (T.tip === "pg" ? 1.5 : .35)) return false; return true; }
const seviye = (c, sd, P, T) => ({ hed:c*(1 + Math.min(T.tMax, Math.max(T.tMin, P.hedefK*sd*Math.sqrt(T.olcek)))), st:c*(1 - Math.min(T.sMax, Math.max(T.sMin, P.stopK*sd*Math.sqrt(T.olcek)))) });
function sim(D, P, T, masraf, tBol){ const out = { tr:{ n:0, kaz:0, top:0 }, te:{ n:0, kaz:0, top:0 } };
  for(const d of D){ let bos = 0;
    for(let i = 100; i < d.n - 1; i++){ if(i < bos) continue; if(!giris(d, i, P, T)) continue; const c = d.c[i], { hed, st } = seviye(c, d.sd[i], P, T);
      if(i + T.H > d.n - 1) break; let cik = null; const son = i + T.H;
      for(let j = i + 1; j <= son; j++){ if(d.l[j] <= st){ cik = st; bos = j; break; } if(d.h[j] >= hed){ cik = hed; bos = j; break; } }
      if(cik == null){ cik = d.c[son]; bos = son; }
      const net = (cik/c - 1)*100 - (T.pazar === "bist" ? MASRAF_BIST : masraf), k = d.t[i] < tBol ? out.tr : out.te; k.n++; k.top += net; if(net > 0) k.kaz++; } }
  return out; }
function sinyal(d, P, T){ if(!d || d.n < 100 || !P) return null; const i = d.n - 1, c = d.c[i], ok = giris(d, i, P, T), { hed, st } = seviye(c, d.sd[i], P, T), L = Math.round(T.Lb*(P.L || 1));
  return { ok, c, sd:d.sd[i], rsi:d.rsi[i], hk:d.v3[i]/(d.vo[L]?.[i] || 1e-12), rj:d.rj[i], hed, st }; }

/* ---------- KUMAR: indikator konseyi + ogrenen model ---------- */
const KUMAR = { k4:{ pazar:"kripto", iv:"4h", ad:"Kumar · indikatör konseyi (kripto)", H:30, kH:2, kS:1.2, ms:4*3600000, adim:2 },
                kb:{ pazar:"bist", iv:"1d", ad:"Kumar · indikatör konseyi (BIST)", H:10, kH:2, kS:1.2, ms:86400000, adim:1 } };
const OZ_AD2 = ["üst zaman dilimi trendi", "üst zaman diliminde fiyat yeri", "RSI uyumsuzluğu (divergence)", "mum formasyonu", "OBV (hacim teyidi)", "piyasa yapısı (tepe/dip)", "dirence mesafe", "desteğe mesafe", "oynaklık rejimi", "Supertrend × rejim", "RSI × rejim", "momentum × hacim"];
const OZ_AD = ["EMA9>EMA21", "fiyat>EMA50", "fiyat>EMA200", "EMA50'ye uzaklık", "MACD histogram", "MACD yükseliyor", "RSI", "Supertrend", "UT Bot", "Squeeze sıkışma", "Squeeze momentum",
  "ADX güç", "DMI yön", "Bollinger %B", "Ichimoku bulut üstü", "Tenkan>Kijun", "hacim patlaması", "son mum", "5 mum getiri", "20 mum getiri", "20 mum tepesine uzaklık", "göreli güç", "piyasa rejimi"];
const emaA = (a, n) => { const o = new Float64Array(a.length), k = 2/(n + 1); for(let i = 0; i < a.length; i++) o[i] = i ? a[i]*k + o[i-1]*(1 - k) : a[i]; return o; };
const smaA = (a, n) => { const o = new Float64Array(a.length).fill(NaN); let s = 0; for(let i = 0; i < a.length; i++){ s += a[i]; if(i >= n) s -= a[i-n]; if(i >= n - 1) o[i] = s/n; } return o; };
const rmaA = (a, n) => { const o = new Float64Array(a.length).fill(NaN); let p = NaN; for(let i = 0; i < a.length; i++){ if(i === n - 1){ let s = 0; for(let j = 0; j < n; j++) s += a[j]; p = s/n; } else if(i >= n) p = (p*(n - 1) + a[i])/n; o[i] = p; } return o; };
const stdA = (a, n) => { const o = new Float64Array(a.length).fill(NaN); for(let i = n - 1; i < a.length; i++){ let m = 0; for(let j = i - n + 1; j <= i; j++) m += a[j]; m /= n; let v = 0; for(let j = i - n + 1; j <= i; j++) v += (a[j] - m)**2; o[i] = Math.sqrt(v/n); } return o; };
const hhA = (a, n) => { const o = new Float64Array(a.length).fill(NaN); for(let i = n - 1; i < a.length; i++){ let m = -Infinity; for(let j = i - n + 1; j <= i; j++) if(a[j] > m) m = a[j]; o[i] = m; } return o; };
const llA = (a, n) => { const o = new Float64Array(a.length).fill(NaN); for(let i = n - 1; i < a.length; i++){ let m = Infinity; for(let j = i - n + 1; j <= i; j++) if(a[j] < m) m = a[j]; o[i] = m; } return o; };
function indikatorler(R){ const n = R.c.length, c = R.c, h = R.h, l = R.l, tr = new Float64Array(n);
  for(let i = 0; i < n; i++) tr[i] = i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1])) : h[i] - l[i];
  const atr = rmaA(tr, 14), atr10 = rmaA(tr, 10), e9 = emaA(c, 9), e21 = emaA(c, 21), e50 = emaA(c, 50), e200 = emaA(c, 200);
  const e26 = emaA(c, 26), e12 = emaA(c, 12), mline = new Float64Array(n); for(let i = 0; i < n; i++) mline[i] = e12[i] - e26[i]; const sig = emaA(mline, 9), mh = mline.map((v, i) => v - sig[i]);
  const rs = rsi(c, 14);
  // Supertrend (10, 3)
  const st = new Int8Array(n); { let up = 0, dn = 0, dir = 1; for(let i = 0; i < n; i++){ const a = atr10[i]; if(!(a > 0)){ st[i] = 0; continue; } const m = (h[i] + l[i])/2, u = m - 3*a, d = m + 3*a;
      up = i && c[i-1] > up ? Math.max(u, up) : u; dn = i && c[i-1] < dn ? Math.min(d, dn) : d; if(dir === -1 && c[i] > dn) dir = 1; else if(dir === 1 && c[i] < up) dir = -1; st[i] = dir; } }
  // UT Bot (key 1, ATR 10)
  const ut = new Int8Array(n); { let ts = c[0]; for(let i = 1; i < n; i++){ const nl = (atr10[i] || 0)*1;
      ts = c[i] > ts && c[i-1] > ts ? Math.max(ts, c[i] - nl) : c[i] < ts && c[i-1] < ts ? Math.min(ts, c[i] + nl) : c[i] > ts ? c[i] - nl : c[i] + nl; ut[i] = c[i] > ts ? 1 : -1; } }
  // Squeeze Momentum (LazyBear)
  const b20 = smaA(c, 20), sd20 = stdA(c, 20), tr20 = smaA(tr, 20), hh20 = hhA(h, 20), ll20 = llA(l, 20), sqz = new Int8Array(n), mom = new Float64Array(n).fill(NaN), dv = new Float64Array(n);
  for(let i = 0; i < n; i++){ const ub = b20[i] + 2*sd20[i], lb = b20[i] - 2*sd20[i], uk = b20[i] + 1.5*tr20[i], lk = b20[i] - 1.5*tr20[i]; sqz[i] = lb > lk && ub < uk ? 1 : 0; dv[i] = c[i] - ((hh20[i] + ll20[i])/2 + b20[i])/2; }
  for(let i = 39; i < n; i++){ let sx = 0, sy = 0, sxy = 0, sxx = 0; for(let j = 0; j < 20; j++){ const y = dv[i - 19 + j]; sx += j; sy += y; sxy += j*y; sxx += j*j; } const b = (20*sxy - sx*sy)/(20*sxx - sx*sx), a = (sy - b*sx)/20; mom[i] = a + b*19; }
  // ADX / DMI (14)
  const pdm = new Float64Array(n), mdm = new Float64Array(n); for(let i = 1; i < n; i++){ const u = h[i] - h[i-1], d = l[i-1] - l[i]; pdm[i] = u > d && u > 0 ? u : 0; mdm[i] = d > u && d > 0 ? d : 0; }
  const atr14 = rmaA(tr, 14), pdi = rmaA(pdm, 14).map((v, i) => 100*v/(atr14[i] || 1e-12)), mdi = rmaA(mdm, 14).map((v, i) => 100*v/(atr14[i] || 1e-12)), dx = pdi.map((v, i) => 100*Math.abs(v - mdi[i])/((v + mdi[i]) || 1e-12)), adx = rmaA(dx.map(v => isFinite(v) ? v : 0), 14);
  // Ichimoku
  const h9 = hhA(h, 9), l9 = llA(l, 9), h26 = hhA(h, 26), l26 = llA(l, 26), h52 = hhA(h, 52), l52 = llA(l, 52), ten = new Float64Array(n), kij = new Float64Array(n);
  for(let i = 0; i < n; i++){ ten[i] = (h9[i] + l9[i])/2; kij[i] = (h26[i] + l26[i])/2; }
  const vs = smaA(R.v, 20);
  // ust zaman dilimi trendi (4 saatlikte ~gunluk, gunlukte ~haftalik): uzun EMA'nin egimi ve fiyatin ona gore yeri
  const eU = emaA(c, 120), eU2 = emaA(c, 300);
  // OBV (hacimle teyit)
  const obv = new Float64Array(n); for(let i = 1; i < n; i++) obv[i] = obv[i-1] + (c[i] > c[i-1] ? R.v[i] : c[i] < c[i-1] ? -R.v[i] : 0); const obvE = emaA(obv, 20);
  // piyasa yapisi: pivot tepe/dipler (5 mum sag-sol), son iki tepe ve dip
  const pvH = [], pvL = []; for(let i = 5; i < n - 5; i++){ let th = true, tl = true; for(let j = i - 5; j <= i + 5; j++){ if(j === i) continue; if(h[j] >= h[i]) th = false; if(l[j] <= l[i]) tl = false; } if(th) pvH.push(i); if(tl) pvL.push(i); }
  // ATR yuzdesinin son 100 mumdaki yuzdelik sirasi (oynaklik rejimi)
  const atrp = new Float64Array(n).fill(NaN); for(let i = 120; i < n; i++){ const x = atr[i]/c[i]; let k = 0; for(let j = i - 100; j < i; j++) if(atr[j]/c[j] < x) k++; atrp[i] = k/100; }
  return { n, c, h, l, o:R.o, atr, e9, e21, e50, e200, eU, eU2, obv, obvE, pvH, pvL, atrp, mh, rs, st, ut, sqz, mom, adx, pdi, mdi, b20, sd20, ten, kij, h52, l52, vs, hh20 }; }
function ozellik(I, R, i, BM, rj){ const c = I.c[i], a = I.atr[i]; if(!(a > 0) || i < 210) return null; const ap = a/c, ok = v => isFinite(v) ? Math.max(-6, Math.min(6, v)) : 0, sg = v => v > 0 ? 1 : v < 0 ? -1 : 0;
  const ic = i - 26, spA = ic >= 0 ? (I.ten[ic] + I.kij[ic])/2 : NaN, spB = ic >= 0 ? (I.h52[ic] + I.l52[ic])/2 : NaN, bbu = I.b20[i] + 2*I.sd20[i], bbl = I.b20[i] - 2*I.sd20[i];
  const r20 = c/I.c[i - 20] - 1, bm = BM ? BM(R.t[i], R.t[i - 20]) : 0;
  return [sg(I.e9[i] - I.e21[i]), sg(c - I.e50[i]), sg(c - I.e200[i]), ok((c/I.e50[i] - 1)/ap/3), ok(I.mh[i]/a), sg(I.mh[i] - I.mh[i-1]), ok((I.rs[i] - 50)/20), I.st[i], I.ut[i], I.sqz[i], ok(I.mom[i]/a/2),
    ok((I.adx[i] - 20)/15), ok((I.pdi[i] - I.mdi[i])/20), ok(((c - bbl)/((bbu - bbl) || 1e-12) - .5)*2), isFinite(spA) ? sg(c - Math.max(spA, spB)) : 0, sg(I.ten[i] - I.kij[i]), ok(Math.log((R.v[i] || 1)/(I.vs[i] || 1))),
    ok((c/I.c[i-1] - 1)/ap), ok((c/I.c[i-5] - 1)/ap/2.2), ok(r20/ap/4.5), ok((c/I.hh20[i] - 1)/ap), ok((r20 - bm)/ap/4.5), rj === 1 ? 1 : rj === 2 ? -1 : 0].concat(ekOzellik(I, R, i, rj, ap)); }
// ek ozellikler: ust zaman dilimi, RSI uyumsuzlugu, mum formasyonu, OBV, piyasa yapisi, destek/direnc, oynaklik rejimi, etkilesimler
function ekOzellik(I, R, i, rj, ap){ const c = I.c[i], a = I.atr[i], ok = v => isFinite(v) ? Math.max(-6, Math.min(6, v)) : 0, sg = v => v > 0 ? 1 : v < 0 ? -1 : 0, rjs = rj === 1 ? 1 : rj === 2 ? -1 : 0;
  const ustT = sg(I.eU[i] - I.eU[i - 6]), ustY = ok((c/I.eU2[i] - 1)/ap/6);
  // RSI uyumsuzlugu: son 14 mumun dibi onceki 14'unkinden asagi ama RSI dibi yukari -> +1 (boga); tepe icin tersi -> -1
  let dv = 0; { let l1 = Infinity, l2 = Infinity, r1 = Infinity, r2 = Infinity, h1 = -Infinity, h2 = -Infinity, q1 = -Infinity, q2 = -Infinity;
    for(let j = i - 13; j <= i; j++){ if(I.l[j] < l1){ l1 = I.l[j]; r1 = I.rs[j]; } if(I.h[j] > h1){ h1 = I.h[j]; q1 = I.rs[j]; } }
    for(let j = i - 27; j <= i - 14; j++){ if(I.l[j] < l2){ l2 = I.l[j]; r2 = I.rs[j]; } if(I.h[j] > h2){ h2 = I.h[j]; q2 = I.rs[j]; } }
    if(l1 < l2 && r1 > r2 + 2) dv = 1; else if(h1 > h2 && q1 < q2 - 2) dv = -1; }
  // mum formasyonu: yutan boga / cekic (+1), yutan ayi / kayan yildiz (-1)
  const o = I.o[i], h = I.h[i], l = I.l[i], o1 = I.o[i-1], c1 = I.c[i-1], gov = Math.abs(c - o) || 1e-12, alt = Math.min(o, c) - l, ust = h - Math.max(o, c);
  const mum = (c > o && c1 < o1 && c >= o1 && o <= c1) || (alt > 2*gov && ust < gov && c < I.e21[i]) ? 1 : (c < o && c1 > o1 && c <= o1 && o >= c1) || (ust > 2*gov && alt < gov && c > I.e21[i]) ? -1 : 0;
  const obv = sg(I.obv[i] - I.obvE[i]);
  // piyasa yapisi: (yalnizca i'den en az 5 mum once onaylanmis pivotlar -> gelecege bakmaz)
  const H = I.pvH.filter(j => j <= i - 5).slice(-2), L = I.pvL.filter(j => j <= i - 5).slice(-2);
  const yapi = H.length === 2 && L.length === 2 ? (I.h[H[1]] > I.h[H[0]] && I.l[L[1]] > I.l[L[0]] ? 1 : I.h[H[1]] < I.h[H[0]] && I.l[L[1]] < I.l[L[0]] ? -1 : 0) : 0;
  const direnc = H.length ? I.h[H[H.length - 1]] : NaN, destek = L.length ? I.l[L[L.length - 1]] : NaN;
  const dirM = isFinite(direnc) && direnc > c ? ok((direnc - c)/a/3) : 2, desM = isFinite(destek) && destek < c ? ok((c - destek)/a/3) : 2;
  const rsN = isFinite(I.rs[i]) ? (I.rs[i] - 50)/20 : 0, vr = Math.log((R.v[i] || 1)/(I.vs[i] || 1));
  return [ustT, ustY, dv, mum, obv, yapi, dirM, desM, isFinite(I.atrp[i]) ? (I.atrp[i] - .5)*2 : 0, I.st[i]*rjs, ok(rsN*rjs), ok(sg(I.mom[i])*Math.max(0, vr))]; }
function sonucBul(R, i, M, masrafY){ const c = R.c[i], a = M.atr; const son = Math.min(R.c.length - 1, i + M.H);
  if(M.iz){ let tepe = c, st = c - M.kS*a; const tavan = c + M.izTavan*a;   // kazanani kostur: stop, gorulen en yuksekten m x ATR geriden takip eder
    for(let j = i + 1; j <= son; j++){ if(R.l[j] <= st) return { net:(st/c - 1)*100 - masrafY, j, hit:st > c ? 1 : -1 }; if(R.h[j] >= tavan) return { net:(tavan/c - 1)*100 - masrafY, j, hit:1 }; tepe = Math.max(tepe, R.h[j]); st = Math.max(st, tepe - M.izM*a); }
    return i + M.H < R.c.length ? { net:(R.c[son]/c - 1)*100 - masrafY, j:son, hit:R.c[son] > c ? 1 : 0 } : null; }
  const hed = c + M.kH*a, st = c - M.kS*a;
  for(let j = i + 1; j <= son; j++){ if(R.l[j] <= st) return { net:(st/c - 1)*100 - masrafY, j, hit:-1 }; if(R.h[j] >= hed) return { net:(hed/c - 1)*100 - masrafY, j, hit:1 }; }
  return i + M.H < R.c.length ? { net:(R.c[son]/c - 1)*100 - masrafY, j:son, hit:0 } : null; }
const sigm = z => 1/(1 + Math.exp(-z));
function lojistik(X, y, ep = 120){ const m = X[0].length, w = new Float64Array(m), mw = new Float64Array(m), vw = new Float64Array(m); let b = 0, mb = 0, vb = 0, t = 0; const lr = .03, l2 = 1e-3, bs = 256, N = X.length, idx = [...Array(N).keys()];
  for(let e = 0; e < ep; e++){ for(let i = N - 1; i > 0; i--){ const j = Math.floor(Math.random()*(i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    for(let s = 0; s < N; s += bs){ const gw = new Float64Array(m); let gb = 0; const E = Math.min(N, s + bs);
      for(let q = s; q < E; q++){ const k = idx[q], x = X[k]; let z = b; for(let f = 0; f < m; f++) z += w[f]*x[f]; const d = sigm(z) - y[k]; for(let f = 0; f < m; f++) gw[f] += d*x[f]; gb += d; }
      t++; const nb = E - s; for(let f = 0; f < m; f++){ const g = gw[f]/nb + l2*w[f]; mw[f] = .9*mw[f] + .1*g; vw[f] = .999*vw[f] + .001*g*g; w[f] -= lr*(mw[f]/(1 - .9**t))/(Math.sqrt(vw[f]/(1 - .999**t)) + 1e-8); }
      const g = gb/nb; mb = .9*mb + .1*g; vb = .999*vb + .001*g*g; b -= lr*(mb/(1 - .9**t))/(Math.sqrt(vb/(1 - .999**t)) + 1e-8); } }
  return { w:[...w], b }; }
const tahmin = (Mo, x) => { let z = Mo.b; for(let f = 0; f < x.length; f++) z += Mo.w[f]*((x[f] - Mo.mu[f])/Mo.sd[f]); return sigm(z); };
async function kumarVeri(mk, M, ctx, nM){ const T = { pazar:M.pazar, iv:M.iv }, L = M.pazar === "bist" ? ctx.B : [...new Map([...ctx.C, ...(ctx.CK || [])].map(x => [x.bn, x])).values()];
  const RJx = M.pazar === "bist" ? ctx.RJB : ctx.RJ;
  // goreli guc icin kiyas: BTC (kripto) / XU100 (BIST)
  const BR = M.pazar === "bist" ? ctx.RJB?.R : kapaliMumlar(await klines("BTCUSDT", "4h", 1000)); const bmap = new Map(); if(BR) BR.t.forEach((t, i) => bmap.set(M.pazar === "bist" ? Math.floor(t/86400) : t, BR.c[i]));
  const anah = t => M.pazar === "bist" ? Math.floor(t/86400) : t, BM = (t, t0) => { const a = bmap.get(anah(t)), b = bmap.get(anah(t0)); return a && b ? a/b - 1 : 0; };
  const V = await havuz(L, M.pazar === "bist" ? 4 : 6, async x => { const ka = x.bn + M.iv + (nM ? nM : ""); ctx.onb[ka] = ctx.onb[ka] || mumlar(T, x, nM || 1000); const R = await ctx.onb[ka]; if(R.c.length < 260 || sicrama(R, nM ? 300 : R.c.length)) return null;
    return { x, R, I:indikatorler(R), rj:R.t.map(t => RJx ? RJx.at(t + M.ms/1000) : 0) }; });
  return { V:V.filter(Boolean), BM }; }
async function kumarEgit(mk, M, ctx){ if(M.pazar === "bist" && !ctx.B?.length) throw new Error("BIST verisi yok");
  const { V, BM } = await kumarVeri(mk, M, ctx), my = M.pazar === "bist" ? MASRAF_BIST : ctx.masraf;
  let tMin = Infinity, tMax = -Infinity; V.forEach(d => { tMin = Math.min(tMin, d.R.t[0]); tMax = Math.max(tMax, d.R.t[d.R.t.length - 1]); }); const tBol = tMin + (tMax - tMin)*.65;
  const X = []; V.forEach((d, di) => { for(let i = 210; i < d.R.c.length - 1; i += M.adim){ const x = ozellik(d.I, d.R, i, BM, d.rj[i]); if(x) X.push({ x, t:d.R.t[i], di, i, atr:d.I.atr[i] }); } });
  const CIKIS = [{ ad:"sabit hedef", iz:false }, { ad:"iz süren stop", iz:true, izM:2.5, izTavan:6 }];
  const isle = (L, esik) => { const bitis = {}; let n = 0, top = 0, kaz = 0; for(const s of L){ if(s.p < esik) continue; if((bitis[s.di] ?? -1) >= s.i) continue; bitis[s.di] = s.j; n++; top += s.net; if(s.net > 0) kaz++; } return { n, ort:n ? top/n : 0, isabet:n ? kaz/n : 0 }; };
  let en = null;
  for(const CK of CIKIS){ const Mx = { ...M, ...CK }, S = [];
    for(const z of X){ const d = V[z.di], s = sonucBul(d.R, z.i, { ...Mx, atr:z.atr }, my); if(s) S.push({ ...z, y:s.net > 0 ? 1 : 0, net:s.net, j:s.j }); }
    S.sort((a, b) => a.t - b.t); const TR = S.filter(s => s.t < tBol), TE = S.filter(s => s.t >= tBol); if(TR.length < 500 || TE.length < 200) continue;
    const m = TR[0].x.length, mu = Array(m).fill(0), sd = Array(m).fill(0); TR.forEach(s => s.x.forEach((v, f) => mu[f] += v/TR.length)); TR.forEach(s => s.x.forEach((v, f) => sd[f] += (v - mu[f])**2/TR.length)); for(let f = 0; f < m; f++) sd[f] = Math.sqrt(sd[f]) || 1;
    const Mo = { ...lojistik(TR.map(s => s.x.map((v, f) => (v - mu[f])/sd[f])), TR.map(s => s.y)), mu, sd };
    TR.forEach(s => s.p = tahmin(Mo, s.x)); TE.forEach(s => s.p = tahmin(Mo, s.x));
    const P = TR.map(s => s.p).sort((a, b) => b - a), es = [.02, .04, .07, .1, .15, .2].map(q => P[Math.floor(P.length*q)]).filter(isFinite);
    let b0 = null; for(const e of es){ const r = isle(TR, e); if(r.n >= 30 && (!b0 || r.ort > b0.tr.ort)) b0 = { esik:e, tr:r }; }
    if(!b0) continue; const te = isle(TE, b0.esik); console.log(`  ${mk} · ${CK.ad}: egitim ${b0.tr.ort.toFixed(2)}% (${b0.tr.n}), ileri test ${te.ort.toFixed(2)}% (${te.n})`);
    if(!en || b0.tr.ort > en.tr.ort) en = { ...b0, te, Mo, CK, n:S.length }; }
  if(!en) throw new Error("yetersiz ornek ya da esik bulunamadi");
  const AD = [...OZ_AD, ...OZ_AD2], onem = en.Mo.w.map((w, f) => ({ ad:AD[f] || ("ö" + f), w:+w.toFixed(3) })).sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 8), te = en.te, Mo = en.Mo;
  const sonuc = { tip:"ml", ad:M.ad, w:Mo.w.map(v => +v.toFixed(5)), b:+Mo.b.toFixed(5), mu:Mo.mu.map(v => +v.toFixed(5)), sd:Mo.sd.map(v => +v.toFixed(5)), esik:+en.esik.toFixed(4), tr:{ n:en.tr.n, ort:en.tr.ort, isabet:en.tr.isabet }, te:te.n ? { n:te.n, ort:te.ort, isabet:te.isabet } : null,
    onem, ornek:en.n, ozellik:AD.length, coin:V.length, H:M.H, kH:M.kH, kS:M.kS, cikis:en.CK, aralik:[tMin, tMax], tBol, aktif:!!(te.n >= 20 && te.ort > .1), P:{ esik:+en.esik.toFixed(4), cikis:en.CK.ad }, ilk5:[] };
  console.log(`egitim ${mk} (${M.ad}): ${V.length} ${M.pazar === "bist" ? "hisse" : "coin"}, ${en.n} ornek, ${AD.length} ozellik, cikis: ${en.CK.ad}, esik %${Math.round(en.esik*100)}, ileri test ${te.n ? te.ort.toFixed(2) + "% (" + te.n + ", isabet %" + Math.round(te.isabet*100) + ")" : "-"} ${sonuc.aktif ? "ACIK" : "KAPALI"} · en etkili: ${onem.slice(0, 3).map(o => o.ad + (o.w > 0 ? "+" : "-")).join(", ")}`);
  return sonuc; }
async function kumarTara(A, ctx, var_, mumVar){ const yeni = [];
  for(const [mk, M] of Object.entries(KUMAR)){ const Mo = A[mk]; if(!Mo?.w) continue; if(M.pazar === "bist" && !ctx.B?.length) continue;
    const { V, BM } = await kumarVeri(mk, M, ctx, 300);
    for(const d of V){ const i = d.R.c.length - 1, x = ozellik(d.I, d.R, i, BM, d.rj[i]); if(!x) continue; if(x.length !== Mo.w.length) continue; const p = tahmin(Mo, x); if(!isFinite(p) || p < Mo.esik) continue;
      const k = (M.pazar === "bist" ? "BIST:" : "KRIPTO:") + d.x.kod, tG = d.R.kap[i], an = `${k}|${mk}|0`; if(M.pazar !== "bist" && Date.now() - tG > BAYAT_DK*60000) continue; if(var_.has(an) || mumVar.has(`${an}|${tG}`)) continue; var_.add(an); mumVar.add(`${an}|${tG}`);
      const c = d.R.c[i], a = d.I.atr[i], uzat = M.pazar === "bist" ? 1.45 : 1;
      const iz = Mo.cikis?.iz ? { m:Mo.cikis.izM, atr:a } : null;
      if(!seviyeOk(c, iz ? c + Mo.cikis.izTavan*a : c + Mo.kH*a, c - Mo.kS*a, M.pazar === "bist" ? .2 : .25)) continue;   // v2.4: negatif/asiri genis stop -> girme
      yeni.push({ user_id:UID, k, alt:mk, ai:0, algo:A.surum, giris:c, hedef:iz ? c + Mo.cikis.izTavan*a : c + Mo.kH*a, stop:c - Mo.kS*a, t:new Date(tG).toISOString(), son:new Date(tG + M.H*M.ms*uzat).toISOString(),
        oz:{ alt:mk, tip:"ml", pk:mk + ":v" + A.surum, p:+p.toFixed(3), pazar:M.pazar, iz, rsi:Math.round(d.I.rs[i]), hk:+Math.exp(x[16]).toFixed(2), deg:d.x.d, bn:d.x.bn, isaret:x.slice(0, 3).concat([x[7], x[8], x[14]]) }, kaynak:"bot", durum:"acik" }); } }
  return yeni; }

/* ---------- egitim ---------- */
async function egit(eski, masraf, RJ, RJB){
  const C = await coinler(EGITIM_COIN), CK = (await coinler(TARAMA_COIN)).slice(40), B = RJB ? await bistListe() : [], yeni = { surum:(eski?.surum || 0) + 1, t:Date.now(), kaynak:"bot", gecmis:eski?.gecmis || [], masraf, rejim:RJ.simdi }, onb = {};
  for(const tf of Object.keys(TF)){ const T = TF[tf];
    if(pazarOf(T) === "bist" && !B.length){ yeni[tf] = { tip:T.tip, ad:T.ad, P:null, ilk5:[], aktif:false, coin:0, hata:"BIST verisi alinamadi" }; console.log(`egitim ${tf}: BIST verisi yok, atlandi`); continue; }
    const LST = pazarOf(T) === "bist" ? B : (T.tip === "pg" || T.ck) ? CK : C, RJx = pazarOf(T) === "bist" ? RJB : RJ;
    const V = (await havuz(LST, pazarOf(T) === "bist" ? 4 : 6, async x => { const ka = x.bn + T.iv; onb[ka] = onb[ka] || mumlar(T, x, 1000); const R = await onb[ka]; return R.c.length > 300 && !sicrama(R, R.c.length) ? { ...hazirla(R, tumL(T), RJx, T.ms/1000), kod:x.kod } : null; })).filter(Boolean);
    let tMin = Infinity, tMax = -Infinity; V.forEach(d => { tMin = Math.min(tMin, d.t[0]); tMax = Math.max(tMax, d.t[d.n - 1]); }); const tBol = tMin + (tMax - tMin)*.65;
    const S = ayarlar(T).map(P => ({ P, ...sim(V, P, T, masraf, tBol) }));
    const oz = s => s && s.n ? { n:s.n, ort:s.top/s.n, isabet:s.kaz/s.n } : null, enAz = T.tip === "kir" ? 50 : 30;
    const gec = S.filter(s => s.tr.n >= enAz && s.te.n >= 15).sort((x, y) => (y.tr.top/y.tr.n - x.tr.top/x.tr.n) || (y.tr.n - x.tr.n)), en = gec[0] || null;
    const ilk5 = []; for(const g of gec){ if(ilk5.length >= 5) break; if(ilk5.some(x => ayarAnahtar(T, x.P) === ayarAnahtar(T, g.P))) continue; ilk5.push({ P:g.P, tr:oz(g.tr), te:oz(g.te) }); }
    // v2.4: piyango ayarlarinin hepsi "sadece yukselis trendinde" (rj=1) olursa ayi piyasasinda kasa kilitleniyordu -> en az bir trend sartsiz ayar
    if((T.tip === "pg" || T.G) && ilk5.length && ilk5.every(x => x.P.rj === 1)){ const g = gec.find(s => s.P.rj !== 1 && s.te.n && s.te.top/s.te.n > 0); if(g){ if(ilk5.length >= 5) ilk5.pop(); ilk5.push({ P:g.P, tr:oz(g.tr), te:oz(g.te), cesit:"trend şartsız" }); } }
    const vars = T.tip === "kir" ? S.find(s => s.P.hedefK === 1 && s.P.stopK === .7 && s.P.rsiMax === 80 && s.P.hk === 1.5 && s.P.L === 2 && s.P.dMin === .03 && s.P.rj === 0) : null;
    yeni[tf] = { tip:T.tip, ad:T.ad, P:en?.P || null, ilk5, tr:oz(en?.tr), te:oz(en?.te), vars:{ tr:oz(vars?.tr), te:oz(vars?.te) }, kombi:S.length, gecerli:gec.length, coin:V.length, aralik:[tMin, tMax], tBol,
      aktif: !!(en && en.te.n >= 15 && en.te.top/en.te.n > .05) };
    console.log(`egitim ${tf} (${T.ad}): ${V.length} ${pazarOf(T) === "bist" ? "hisse" : "coin"}, ${S.length} ayar, gecerli ${gec.length}, en iyi ileri test ${yeni[tf].te ? yeni[tf].te.ort.toFixed(2) + "% (" + yeni[tf].te.n + ")" : "-"} ${yeni[tf].aktif ? "ACIK" : "KAPALI"}`); }
  // KUMAR: indikator konseyi (kripto 4 saatlik + BIST gunluk)
  for(const [mk, M] of Object.entries(KUMAR)){ try{ yeni[mk] = await kumarEgit(mk, M, { C, CK, B, onb, RJ, RJB, masraf }); }catch(e){ yeni[mk] = { tip:"ml", ad:M.ad, aktif:false, hata:e.message }; console.log(`egitim ${mk}: HATA ${e.message}`); } }
  const g = { surum:yeni.surum, t:yeni.t, rejim:RJ.simdi }; for(const tf of [...Object.keys(TF), ...Object.keys(KUMAR)]){ g[tf] = yeni[tf]?.te; g[tf + "a"] = yeni[tf]?.aktif; }
  yeni.gecmis = yeni.gecmis.concat([g]).slice(-120);
  return yeni; }

/* ---------- tarama: kurala uyan her coin -> sanal islem ---------- */
async function tara(A, masraf, RJ, RJB, ctx){
  const C = await coinler(TARAMA_COIN), acik = await sbHepsi(`piyasa_sanal?user_id=eq.${UID}&durum=eq.acik&select=id,k,alt,ai,algo`), var_ = new Set(acik.map(o => `${o.k}|${o.alt}|${o.ai}`)), yeni = [];
  // ayni mumdan ikinci kez giris olmasin (onceki islem kapanmis olsa bile)
  const yakin = await sbHepsi(`piyasa_sanal?user_id=eq.${UID}&t=gte.${new Date(Date.now() - 4*86400000).toISOString()}&select=id,k,alt,ai,t`), mumVar = new Set(yakin.map(o => `${o.k}|${o.alt}|${o.ai}|${new Date(o.t).getTime()}`));
  const onb = ctx.onb, B = RJB ? await bistListe() : [];
  for(const tf of Object.keys(TF)){ const T = TF[tf], AY = (A[tf]?.ilk5?.length ? A[tf].ilk5 : A[tf]?.P ? [{ P:A[tf].P }] : []).map((a, i) => ({ ...a, i })); if(!AY.length) continue;
    const bist = pazarOf(T) === "bist"; if(bist && !B.length) continue; const LST = bist ? B : C, RJx = bist ? RJB : RJ;
    await havuz(LST, bist ? 4 : 6, async x => { const nM = bist ? 300 : T.tip === "pg" ? 260 : 151, ka = x.bn + T.iv + nM; onb[ka] = onb[ka] || mumlar(T, x, nM); const R = await onb[ka]; if(R.c.length < 100) return; const tGiris = R.kap[R.kap.length - 1];
      if(bist && Date.now() - tGiris > 4*86400000) return;   // eski mum (tatil/veri yok) -> sinyal verme
      if(!bist && Date.now() - tGiris > BAYAT_DK*60000) return;   // gec kalinmis sinyal: o fiyat artik yok, sahte kazanc/kayip yazmasin
      const d = hazirla(R, tumL(T), RJx, T.ms/1000);
      if(sicrama(R)) return;   // bolunme/yeniden fiyatlama -> sahte dip/kirilim sinyali verme
      for(const a of AY){ const s = sinyal(d, a.P, T); if(!s?.ok || !seviyeOk(s.c, s.hed, s.st, .35)) continue; const k = (bist ? "BIST:" : "KRIPTO:") + x.kod, an = `${k}|${tf}|${a.i}`; if(var_.has(an) || mumVar.has(`${an}|${tGiris}`)) continue; var_.add(an); mumVar.add(`${an}|${tGiris}`);
        yeni.push({ user_id:UID, k, alt:tf, ai:a.i, algo:A.surum, giris:s.c, hedef:s.hed, stop:s.st, t:new Date(tGiris).toISOString(), son:new Date(tGiris + T.H*T.ms*(bist ? 1.45 : 1)).toISOString(),
          oz:{ alt:tf, tip:T.tip, pk:ayarKimlik(tf, a.P), rj:s.rj, pazar:bist ? "bist" : "kripto", rsi:Math.round(s.rsi), hk:+(s.hk || 0).toFixed(2), kir:T.tip === "kir", deg:x.d, saat:+new Date(tGiris).toLocaleString("en-US", { timeZone:"Europe/Istanbul", hour:"numeric", hour12:false }) % 24, ih:null, bn:x.bn }, kaynak:"bot", durum:"acik" }); } }); }
  try{ yeni.push(...await kumarTara(A, { ...ctx, B }, var_, mumVar)); }catch(e){ console.log("kumar tarama hatasi:", e.message); }
  const eklenen = []; for(let i = 0; i < yeni.length; i += 200){ const r = await sb("piyasa_sanal", "POST", yeni.slice(i, i + 200), { Prefer:"return=representation" }); if(Array.isArray(r)) eklenen.push(...r); }
  return { taranan:C.length, bist:B.length, yeni:yeni.length, eklenen }; }

/* ---------- sonuclandirma: 15 dakikalik mumlarla once hangisine degdi ---------- */
async function sonuclandir(masraf){
  const acik = await sbHepsi(`piyasa_sanal?user_id=eq.${UID}&durum=eq.acik&select=id,k,giris,hedef,stop,t,son,oz`); let bitti = 0; const kapanan = {};
  await havuz(acik, 5, async o => { const bist = /^BIST:/.test(o.k), bn = o.oz?.bn || (bist ? o.k.slice(5) + ".IS" : o.k.replace("KRIPTO:", "") + "USDT"), t0 = new Date(o.t).getTime(), son = new Date(o.son).getTime(); let s = null;
    let r; if(bist){ const Y = await yahoo(bn, "60m", null, t0 - 3600000); r = Y.t.map((t, i) => [t*1000, Y.o[i], Y.h[i], Y.l[i], Y.c[i]]).filter(m => m[0] >= t0); }
    else r = await jget(`${BN}/api/v3/klines?symbol=${bn}&interval=15m&startTime=${t0}&limit=1000`);
    let st = +o.stop, tepe = +o.giris; const iz = o.oz?.iz, guv = !(st > 0) || st >= +o.giris; if(guv) st = +o.giris*.75;   // v2.4: bozuk (negatif) stoplu eski islemler icin %25 guvenlik stopu
    for(const m of (r || [])){ const t = +m[0]; if(t >= son) break; if(+m[3] <= st){ s = { cikis:st, neden:iz && st > +o.giris ? "iz süren stop (kârda)" : iz && st > +o.stop ? "iz süren stop" : guv ? "zarar kes (güvenlik stopu)" : "zarar kes", ct:t }; break; } if(+m[2] >= +o.hedef){ s = { cikis:+o.hedef, neden:"hedef", ct:t }; break; }
      if(iz){ tepe = Math.max(tepe, +m[2]); st = Math.max(st, tepe - iz.m*iz.atr); } }
    if(!s && Date.now() > son && r?.length){ const z = r.filter(m => +m[0] < son).pop() || r[r.length - 1]; s = { cikis:+z[4], neden:"süre doldu", ct:son }; }
    if(!s) return; const brut = (s.cikis/o.giris - 1)*100;
    const net = +(brut - (bist ? MASRAF_BIST : masraf)).toFixed(4); await sb(`piyasa_sanal?id=eq.${o.id}`, "PATCH", { durum:"kapali", cikis:s.cikis, neden:s.neden, ct:new Date(s.ct).toISOString(), net }, { Prefer:"return=minimal" }); kapanan[o.id] = { net, ct:s.ct, neden:s.neden }; bitti++; });
  return { acik:acik.length, bitti, kapanan }; }

/* ---------- SANAL KASALAR (her biri 50.000 TL; bakiye 1.000 TL altina inerse yeni tur 50.000 TL — sinirsiz tecrube) ----------
   v2.4 (Claude, 26 Kasim 2026, 1 haftalik tecrube raporundan):
     - piyango kasasi ayida kilitliydi (kripto piyangoda gecerli ayar 0, BIST piyangonun 5 ayarinin 5'i de "sadece yukselis trendi") ->
       yeni "Piyango · dipten donus" stratejileri (kripto 1 hafta + BIST 2 hafta, buyuk hedef) + her piyango stratejisinde en az bir trend sartsiz ayar
     - birlikte hareket eden buyuk coinler (BTC/ETH/SOL/XRP/BNB...): her kasada ayni anda en fazla 1 (20 Kasim'da kumar kasasi hepsinde ayni gun stop oldu)
     - disiplinli kasa islem basina kasanin en fazla %33'unu baglar (eskiden yarisi)
     - bolunme/yeniden fiyatlama korumasi + negatif stop korumasi (SNDKB -%16,4 hatasi)
   v2.3 kasa ayarlari (Claude, 23 Kasim 2026):
   "disiplin": sadece kendini kanitlamis stratejiler. Ayni anda en fazla 2 islem, islem basi %5 risk. (degismedi, calisiyor)
   "her"     : PIYANGO kasasi. Kripto + BIST piyango sinyalleri; artik en iyi 5 ayarin ileri testte kârli olan HEPSI sinyal verir
               (eskiden sadece 1. ayar -> neredeyse hic islem acilmiyordu). Ayni anda 5 islem, islem basi %2 risk.
               "Tum parayi bas" kurali KALDIRILDI: kanitli buyuk firsatta sadece risk 2 katina cikar (islem basi en fazla kasanin %20'si).
   "kumar"   : KUMAR kasasi. Indikator konseyi modeli. Ceyrek Kelly, islem basi en fazla %2 risk ve kasanin %15'i, ayni anda 3 islem.
               BTC dusus trendindeyken (4s fiyat < EMA50) ayni anda en fazla 2 islem ve yarim pozisyon.
   Ortak frenler (uc kasa): ust uste 3 kayip -> 24 saat yeni islem yok; kasa tepeden %15+ asagidaysa pozisyonlar yariya iner;
               zarar kesen coine ayni kasada 24 saat tekrar girilmez. */
const KASA_BAS = 50000, KASA_BATTI = 1000, SAAT = 3600000;
const KASA_AYAR = { disiplin:{ risk:5, maks:2, payTavan:.33, ad:"Disiplinli" },
                    her:{ risk:2, maks:5, ad:"Piyango", buyukKat:2, tavan:.2 },
                    kumar:{ risk:2, maks:3, ad:"Kumar", kelly:.25, tavan:.15, ayiMaks:2, ayiKat:.5 } };
const BUYUK = /^KRIPTO:(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|TRX|LTC|AVAX|LINK|DOT|BCH|SUI|TON|XLM|HBAR)$/;   // birlikte hareket eden buyukler: kasa basina ayni anda 1
const FREN = { seri:3, seriSaat:24, dusus:.15, dususKat:.5, sogukSaat:24 };
// canli kanit: ayarin KENDISINE gore (surum/sira degil). Egitim ayni ayari tekrar secerse gecmis canli sonuclari birikmeye devam eder.
async function canliKanit(A){ const t0 = new Date(Date.now() - 45*86400000).toISOString();
  const L = await sbHepsi(`piyasa_sanal?user_id=eq.${UID}&durum=eq.kapali&t=gte.${t0}&select=id,alt,net,t,oz`), k = {};
  for(const tf of Object.keys(TF)){ let en = null; (A[tf]?.ilk5 || []).forEach((a, i) => { const pk = ayarKimlik(tf, a.P), X = L.filter(x => x.oz?.pk === pk), n = X.length, ort = n ? X.reduce((t, x) => t + +x.net, 0)/n : 0;
      const gun = new Set(X.map(x => String(x.t).slice(0, 10))).size; a.canli = { n, ort:+ort.toFixed(3), isabet:n ? +(X.filter(x => +x.net > 0).length/n).toFixed(3) : null, gun };
      if(n >= 30 && gun >= 4 && ort > .1 && (!en || ort > en.ort)) en = { i, n, ort }; }); if(en) k[tf] = en; }
  return k; }
function kasaYeni(){ return { tur:1, bas:KASA_BAS, bakiye:KASA_BAS, acik:[], turlar:[], egri:[{ t:Date.now(), b:KASA_BAS }], islem:0, kazan:0, tepe:KASA_BAS, maxDus:0 }; }
function kasaIsle(K, kapanan, adaylar, O, ort = {}){ const simdi = ort.simdi || Date.now(), ayi = ort.rejim === 2;
  // 1) kapanan islemler
  const kal = []; K.soguk = K.soguk || {}; K.seri = K.seri || 0;
  for(const p of K.acik){ const c = kapanan[p.id]; if(!c){ kal.push(p); continue; } K.bakiye += p.para*c.net/100; K.islem++; (K.gecmis = K.gecmis || []).push({ id:p.id, k:p.k, alt:p.alt, ai:p.ai, para:p.para, not:p.not, tur:K.tur, net:c.net, kz:+(p.para*c.net/100).toFixed(2), neden:c.neden, t:p.t, ct:c.ct }); if(c.net > 0) K.kazan++; K.egri.push({ t:c.ct, b:+K.bakiye.toFixed(2) }); K.tepe = Math.max(K.tepe, K.bakiye); K.maxDus = Math.max(K.maxDus, 1 - K.bakiye/K.tepe);
    if(c.net > 0) K.seri = 0; else { K.seri++; if(K.seri >= FREN.seri){ K.fren = (c.ct || simdi) + FREN.seriSaat*SAAT; K.seri = 0; } }
    if(c.net <= 0 && /zarar/.test(c.neden || "")) K.soguk[p.k] = (c.ct || simdi) + FREN.sogukSaat*SAAT; }
  K.acik = kal; for(const k in K.soguk) if(K.soguk[k] < simdi) delete K.soguk[k];
  // 2) batti mi? yeni tur
  if(K.bakiye < KASA_BATTI && !K.acik.length){ K.turlar.push({ tur:K.tur, bas:K.bas, son:+K.bakiye.toFixed(2), islem:K.islem, kazan:K.kazan, bitis:Date.now(), neden:"battı" }); K.tur++; K.bakiye = KASA_BAS; K.bas = KASA_BAS; K.islem = 0; K.kazan = 0; K.tepe = KASA_BAS; K.maxDus = 0; K.seri = 0; K.fren = 0; K.soguk = {}; K.egri.push({ t:Date.now(), b:KASA_BAS, yeniTur:K.tur }); }
  // 3) yeni girisler (frenler)
  if(K.fren && K.fren > simdi){ K.durum = `fren: üst üste ${FREN.seri} kayıp, ${new Date(K.fren).toLocaleString("tr-TR", { timeZone:"Europe/Istanbul", hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" })} saatine kadar yeni işlem yok`; return kasaSon(K); }
  const dususte = K.bakiye < K.tepe*(1 - FREN.dusus), maks = ayi && O.ayiMaks ? Math.min(O.maks, O.ayiMaks) : O.maks;
  let kat = 1; if(dususte) kat *= FREN.dususKat; if(ayi && O.ayiKat) kat *= O.ayiKat;
  K.durum = [dususte ? `kasa tepeden %${Math.round((1 - K.bakiye/K.tepe)*100)} aşağıda: yarım pozisyon` : "", ayi && O.ayiMaks ? `BTC düşüş trendinde: en fazla ${maks} işlem${O.ayiKat ? ", yarım pozisyon" : ""}` : ""].filter(Boolean).join(" · ") || "normal";
  for(const x of adaylar){ if(K.acik.length >= maks || K.acik.some(p => p.k === x.k) || (K.soguk[x.k] || 0) > simdi) continue;
    if(BUYUK.test(x.k) && K.acik.some(p => BUYUK.test(p.k))) continue;
    const kay = Math.max(.005, 1 - x.stop/x.giris) + .005, kullan = K.acik.reduce((t, p) => t + p.para, 0), bos = K.bakiye - kullan;
    const riskPara = K.bakiye*O.risk/100/kay; let para = Math.min(bos, K.bakiye*(O.payTavan || 1/O.maks), riskPara), not = "";
    if(O.kelly && x.oz?.p){ const R = Math.max(.3, (x.hedef/x.giris - 1)/Math.max(.005, 1 - x.stop/x.giris)), f = x.oz.p - (1 - x.oz.p)/R; if(f <= 0) continue;
      para = Math.min(bos, riskPara, K.bakiye*Math.min(O.tavan, f*O.kelly)); not = `olasılık %${Math.round(x.oz.p*100)}`; }
    if(O.buyukKat && x.buyuk){ para = Math.min(bos, riskPara*O.buyukKat, K.bakiye*O.tavan); not = "kanıtlı büyük fırsat: 2 kat risk"; }
    para *= kat; if(kat < 1) not = (not ? not + " · " : "") + "yarım pozisyon";
    if(para < 10) continue; K.acik.push({ id:x.id, k:x.k, alt:x.alt, ai:x.ai, para:+para.toFixed(2), t:Date.now(), not }); }
  return kasaSon(K); }
function kasaSon(K){ K.egri = K.egri.slice(-3000); K.gecmis = (K.gecmis || []).slice(-1000); return K; }

/* ---------- ana akis ---------- */
(async () => {
  const bas = Date.now(), satir = (await sb(`piyasa_bot?user_id=eq.${UID}&select=*`))[0] || null, masraf = +(satir?.masraf ?? process.env.MASRAF ?? .5);
  let A = satir?.algo || null, egitildi = false;
  const RJ = await rejimKur().catch(() => ({ at:() => 0, simdi:0, fark:0 }));
  const RJB = await rejimBist().catch(e => { console.log("BIST verisi alinamadi (Yahoo):", e.message); return null; }), ctx = { onb:{}, RJ, RJB, masraf };
  if(!A?.surum || !A.t || !A.d1 || !A.p4 || !A.pd || !A.bd || !A.k4 || Object.keys(KUMAR).some(mk => A[mk]?.w && A[mk].w.length !== OZ_AD.length + OZ_AD2.length) || Date.now() - A.t > EGITIM_SAAT*3600000 || process.env.ZORLA_EGIT === "1"){ A = await egit(A, masraf, RJ, RJB); egitildi = true; }
  ctx.C = await coinler(80); ctx.CK = [];
  const T1 = await tara(A, masraf, RJ, RJB, ctx), S1 = await sonuclandir(masraf);
  // sanal kasalar
  const kasa = satir?.kasa || {}, kanit = await canliKanit(A).catch(() => ({}));
  const sira = L => L.slice().sort((a, b) => +b.oz?.hk - +a.oz?.hk);
  const disiplinAday = sira(T1.eklenen.filter(x => { if(PIYANGO.has(x.alt)) return false; const k = kanit[x.alt]; return k ? x.ai === k.i : A[x.alt]?.aktif && x.ai === 0; }));
  const buyukMu = x => { const c = A[x.alt]?.ilk5?.[x.ai]?.canli; return !!(c && c.n >= 20 && c.ort >= 2 && c.isabet >= .45); };
  // piyango kasasi: en iyi 5 ayarin ileri testte (ya da canlida) kârli olan hepsi; once kanitli olanlar, sonra ileri testi iyi olanlar
  const pgSkor = x => { const a = A[x.alt]?.ilk5?.[x.ai]; return (a?.canli?.n >= 10 ? a.canli.ort : 0)*2 + (a?.te?.ort || 0); };
  const pgUygun = x => { const a = A[x.alt]?.ilk5?.[x.ai]; if(!a) return x.ai === 0; if(a.canli?.n >= 10) return a.canli.ort > 0; return (a.te?.ort || 0) > 0; };
  const herAday = T1.eklenen.filter(x => PIYANGO.has(x.alt) && pgUygun(x)).map(x => ({ ...x, buyuk:buyukMu(x) })).sort((a, b) => (b.buyuk - a.buyuk) || (pgSkor(b) - pgSkor(a)) || (+b.oz?.hk - +a.oz?.hk));
  const kumarAday = T1.eklenen.filter(x => x.oz?.tip === "ml" && A[x.alt]?.aktif).sort((a, b) => b.oz.p - a.oz.p);   // kumar kasasi
  // kasadaki acik pozisyonlarin guncel durumu (ayni calismada acilip kapananlar dahil)
  const idler = [...new Set([...(kasa.disiplin?.acik || []), ...(kasa.her?.acik || []), ...(kasa.kumar?.acik || [])].map(p => p.id))], kapanmis = {};
  for(let i = 0; i < idler.length; i += 100){ const L = await sb(`piyasa_sanal?id=in.(${idler.slice(i, i + 100).join(",")})&select=id,durum,net,ct,neden`); (L || []).forEach(x => { if(x.durum === "kapali") kapanmis[x.id] = { net:+x.net, ct:new Date(x.ct).getTime(), neden:x.neden }; }); }
  // 5.000'lik eski donem -> 50.000'lik yeni kasa (eski ozet saklanir)
  for(const k of ["disiplin", "her", "kumar"]) if(kasa[k] && kasa[k].bas !== KASA_BAS && !kasa[k].turlar?.some(t => t.bas === KASA_BAS)){ const o = kasa[k]; kasa[k] = { ...kasaYeni(), eski:{ bas:o.bas, son:+(+o.bakiye).toFixed(2), islem:(o.turlar || []).reduce((t, x) => t + (x.islem || 0), 0) + (o.islem || 0), bitis:Date.now() } }; }
  const ortam = { rejim:RJ.simdi, simdi:Date.now() };
  kasa.disiplin = kasaIsle(kasa.disiplin || kasaYeni(), kapanmis, disiplinAday, KASA_AYAR.disiplin, ortam); kasa.her = kasaIsle(kasa.her || kasaYeni(), kapanmis, herAday, KASA_AYAR.her, ortam); kasa.kumar = kasaIsle(kasa.kumar || kasaYeni(), kapanmis, kumarAday, KASA_AYAR.kumar, ortam); kasa.ayar = { surum:"2.4", KASA_AYAR, FREN }; kasa.kanit = kanit;
  const kayit = { user_id:UID, algo:A, kasa, son_tarama:new Date().toISOString(), ...(egitildi ? { son_egitim:new Date().toISOString() } : {}), durum:{ rejim:RJ.simdi, btcFark:+(RJ.fark*100).toFixed(2), acikStrateji:[...Object.keys(TF), ...Object.keys(KUMAR)].filter(tf => A[tf]?.aktif || kanit[tf]), bistRejim:RJB?.simdi || 0, bistFark:RJB ? +(RJB.fark*100).toFixed(2) : null, bist:T1.bist, taranan:T1.taranan, yeni:T1.yeni, acik:S1.acik - S1.bitti, bitti:S1.bitti, sure:Math.round((Date.now() - bas)/1000), masraf } };
  await sb("piyasa_bot?on_conflict=user_id", "POST", kayit, { Prefer:"resolution=merge-duplicates,return=minimal" });
  console.log(`kasa: disiplinli tur ${kasa.disiplin.tur} ${Math.round(kasa.disiplin.bakiye)} TL (${kasa.disiplin.acik.length} acik) · piyango tur ${kasa.her.tur} ${Math.round(kasa.her.bakiye)} TL (${kasa.her.acik.length} acik) · kumar tur ${kasa.kumar.tur} ${Math.round(kasa.kumar.bakiye)} TL (${kasa.kumar.acik.length} acik)`);
  console.log(`tamam: ${T1.taranan} coin + ${T1.bist} BIST hissesi tarandi, +${T1.yeni} yeni sanal islem, ${S1.bitti} sonuclandi, acik ${S1.acik - S1.bitti}, algoritma v${A.surum}${egitildi ? " (yeni egitildi)" : ""}, ${Math.round((Date.now() - bas)/1000)} sn`);
})().catch(e => { console.error("HATA:", e.message); process.exit(1); });
