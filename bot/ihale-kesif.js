// Ihale avcisi KESIF 4: Milli Emlak GET sayfalama (cerezli) + ilan.gov.tr API sunucusu (sadece okur)
const UA = { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", "Accept-Language":"tr-TR,tr;q=0.9" };
let CEREZ = {}; const cerezStr = () => Object.entries(CEREZ).map(([k, v]) => k + "=" + v).join("; ");
async function al(u, o = {}){ const r = await fetch(u, { method:o.method || "GET", body:o.body, redirect:"manual", headers:{ ...UA, Cookie:cerezStr(), ...(o.headers || {}) } });
  for(const c of r.headers.getSetCookie?.() || []){ const [kv] = c.split(";"); const i = kv.indexOf("="); CEREZ[kv.slice(0, i).trim()] = kv.slice(i + 1); }
  if(r.status >= 300 && r.status < 400 && r.headers.get("location")) return al(new URL(r.headers.get("location"), u).href, { headers:o.headers }); return { s:r.status, t:await r.text() }; }
const satirlar = t => (t.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(1).map(x => x.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 70));
(async () => {
  const U = "https://www.turkiye.gov.tr/csb-tasinmaz-satis-ilanlari-ihaleye-cikanlar";
  try{ const a = await al(U); console.log("sayfa ilk:", satirlar(a.t)[0], "| son:", satirlar(a.t).slice(-1)[0]);
    for(const sf of ["1", "2", "20", "40"]){ const r = await al(U + "?sf=" + sf, { headers:{ Referer:U } }); const L = satirlar(r.t); console.log(`GET sf=${sf} -> ${r.s} adet ${L.length} ilk: ${L[0]} | son: ${L.slice(-1)[0]}`); }
    const r2 = await al(U + "?sf=2"); const d = await al(U + "?detay=bilgisi&sf=2&index=0"); console.log("sf=2 detay0:", d.t.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/Taşınmaz Bilgileri[\s\S]{0,500}/)?.[0]);
  }catch(e){ console.log("MILLI EMLAK HATA", e.message); }
  // ilan.gov.tr: ABP uygulamalarinda API adresi assets/appconfig*.json icinde durur
  for(const u of ["https://www.ilan.gov.tr/assets/appconfig.json", "https://www.ilan.gov.tr/assets/appconfig.production.json"]){ try{ const r = await al(u); console.log(u, r.s, r.t.slice(0, 600)); }catch(e){ console.log(u, "HATA", e.message); } }
  try{ const { t } = await al("https://www.ilan.gov.tr/"); const js = (t.match(/src="(main-es2015[^"]+)"/) || [])[1]; const { t:J } = await al("https://www.ilan.gov.tr/" + js);
    console.log("remoteServiceBaseUrl izleri:", JSON.stringify([...new Set(J.match(/.{0,80}(remoteServiceBaseUrl|API_BASE_URL|apiUrl|baseApi).{0,120}/g) || [])].slice(0, 6)));
    const k = J.indexOf("class AdsByFilterInput") >= 0 ? J.indexOf("class AdsByFilterInput") : J.search(/AdsByFilterInput|AdFilterInput|SearchAdInput/); if(k >= 0) console.log("girdi sinifi:", J.slice(k, k + 1500).replace(/\s+/g, " "));
    const q = J.indexOf("adsByFilter("); let say = 0; let i = J.indexOf(".adsByFilter(", 0); while(i >= 0 && say < 3){ console.log("cagiran:", J.slice(Math.max(0, i - 900), i + 120).replace(/\s+/g, " ")); i = J.indexOf(".adsByFilter(", i + 5); say++; }
  }catch(e){ console.log("ILAN HATA", e.message); }
})();
