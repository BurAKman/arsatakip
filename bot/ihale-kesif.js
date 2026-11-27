// Ihale avcisi KESIF 3: Milli Emlak sayfalama (form POST + cerez) ve ilan.gov.tr AdsByFilter parametreleri (sadece okur)
const UA = { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", "Accept-Language":"tr-TR,tr;q=0.9" };
let CEREZ = {}; const cerezStr = () => Object.entries(CEREZ).map(([k, v]) => k + "=" + v).join("; ");
async function al(u, o = {}){ const r = await fetch(u, { method:o.method || "GET", body:o.body, redirect:"manual", headers:{ ...UA, Cookie:cerezStr(), ...(o.headers || {}) } });
  for(const c of r.headers.getSetCookie?.() || []){ const [kv] = c.split(";"); const i = kv.indexOf("="); CEREZ[kv.slice(0, i).trim()] = kv.slice(i + 1); }
  if(r.status >= 300 && r.status < 400 && r.headers.get("location")) return al(new URL(r.headers.get("location"), u).href, { headers:o.headers }); return { s:r.status, t:await r.text() }; }
const satir1 = t => ((t.match(/<tr[\s\S]*?<\/tr>/g) || [])[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
(async () => {
  const U = "https://www.turkiye.gov.tr/csb-tasinmaz-satis-ilanlari-ihaleye-cikanlar";
  try{ const { t } = await al(U); const f = (t.match(/<form[^>]*name="listForm"[\s\S]*?<\/form>/) || t.match(/<form[^>]*id="listForm"[\s\S]*?<\/form>/) || [""])[0];
    console.log("### listForm:", f.replace(/\s+/g, " ").slice(0, 1500));
    const action = (f.match(/action="([^"]*)"/) || [])[1] || U; const gizli = {}; (f.match(/<input[^>]*>/g) || []).forEach(x => { const n = (x.match(/name="([^"]+)"/) || [])[1], v = (x.match(/value="([^"]*)"/) || [])[1] || ""; if(n) gizli[n] = v; });
    console.log("action", action, "alanlar", JSON.stringify(gizli), "cerez", Object.keys(CEREZ).join(","));
    console.log("sayfa linkleri:", JSON.stringify([...new Set((t.match(/<a[^>]*(sf|sayfa|page)[^>]*>[^<]*<\/a>/gi) || []).map(x => x.replace(/\s+/g, " ")))].slice(0, 12)));
    console.log("sayfa1:", satir1(t));
    for(const sf of ["2", "1", "20"]){ const body = new URLSearchParams({ ...gizli, sf }).toString(); const r = await al(new URL(action, U).href, { method:"POST", body, headers:{ "Content-Type":"application/x-www-form-urlencoded", Referer:U } }); console.log(`POST sf=${sf} ->`, r.s, satir1(r.t)); }
    const d = await al(U + "?detay=bilgisi&sf=&index=0"); console.log("detay0:", d.s, d.t.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/Taşınmaz Satış İlan Detay[\s\S]{0,1500}|İhale[\s\S]{0,1200}/)?.[0]?.slice(0, 1500));
  }catch(e){ console.log("MILLI EMLAK HATA", e.message); }
  // ilan.gov.tr: AdsByFilter cagrisinin govdesi
  try{ const { t } = await al("https://www.ilan.gov.tr/"); const js = (t.match(/src="(main-es2015[^"]+)"/) || [])[1]; const { t:J } = await al("https://www.ilan.gov.tr/" + js);
    let i = J.indexOf("AdsByFilter"); for(let k = 0; k < 3 && i >= 0; k++){ console.log(`\n### AdsByFilter baglam ${k}:`, J.slice(Math.max(0, i - 700), i + 500).replace(/\s+/g, " ")); i = J.indexOf("AdsByFilter", i + 10); }
    const m = J.match(/class \w*AdFilter\w*[\s\S]{0,1200}/); if(m) console.log("filtre sinifi:", m[0].replace(/\s+/g, " "));
    for(const govde of [{ keys:{ q:["tarla"] }, skipCount:0, maxResultCount:5 }, { keys:{}, skipCount:0, maxResultCount:5 }, { searchText:"tarla", skipCount:0, maxResultCount:5 }]){
      const r = await al("https://www.ilan.gov.tr/api/services/app/Ad/AdsByFilter", { method:"POST", body:JSON.stringify(govde), headers:{ "Content-Type":"application/json", Accept:"application/json" } }); console.log("POST", JSON.stringify(govde), "->", r.s, r.t.slice(0, 900)); }
  }catch(e){ console.log("ILAN HATA", e.message); }
})();
