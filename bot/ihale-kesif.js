// Ihale avcisi KESIF 2: veri adreslerini ve sayfalama yapisini bul (sadece okur)
const UA = { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", "Accept-Language":"tr-TR,tr;q=0.9" };
const al = async (u, o = {}) => { const r = await fetch(u, { headers:{ ...UA, ...(o.headers || {}) }, method:o.method || "GET", body:o.body, redirect:"follow" }); return { s:r.status, t:await r.text(), u:r.url }; };
const uniq = a => [...new Set(a)];
(async () => {
  // 1) Milli Emlak: sayfalama, detay linkleri, form alanlari, satir yapisi
  try{ const { t } = await al("https://www.turkiye.gov.tr/csb-tasinmaz-satis-ilanlari-ihaleye-cikanlar");
    console.log("\n### MILLI EMLAK hrefler:", JSON.stringify(uniq((t.match(/href="([^"]*(sf=|ilan=|Detay|detay|id=)[^"]*)"/g) || []).map(x => x.slice(6, -1))).slice(0, 30)));
    console.log("form alanlari:", JSON.stringify(uniq((t.match(/name="([^"]+)"/g) || []).map(x => x.slice(6, -1))).slice(0, 40)));
    console.log("sayfa bilgisi:", (t.match(/[^>]{0,80}(sayfa|Sayfa|kayıt|Kayıt)[^<]{0,80}/g) || []).slice(0, 8).join(" || "));
    const tr = (t.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(1, 3); console.log("ornek satir html:", tr.join("\n").replace(/\s+/g, " ").slice(0, 1500)); }catch(e){ console.log("MILLI EMLAK HATA", e.message); }
  try{ const { s, t } = await al("https://www.turkiye.gov.tr/csb-tasinmaz-satis-ilanlari-ihaleye-cikanlar?sf=2"); console.log("sf=2 ->", s, "ilk satir:", ((t.match(/<tr[\s\S]*?<\/tr>/g) || [])[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200)); }catch(e){ console.log("sf HATA", e.message); }
  // 2) ilan.gov.tr: angular paketinden api adresleri
  try{ const { t } = await al("https://www.ilan.gov.tr/"); const js = (t.match(/src="(main-es2015[^"]+)"/) || [])[1];
    if(js){ const { t:J } = await al("https://www.ilan.gov.tr/" + js); console.log("\n### ILAN.GOV.TR js", J.length, "api:", JSON.stringify(uniq((J.match(/["'`](\/?api\/[^"'`\s]{3,120})["'`]/g) || []).map(x => x.slice(1, -1))).slice(0, 60)));
      console.log("baseurl izleri:", JSON.stringify(uniq((J.match(/https?:\/\/[a-z0-9.\-]*ilan[a-z0-9.\-]*\.[a-z.]+[^"'`\s]{0,60}/gi) || [])).slice(0, 20))); } }catch(e){ console.log("ILAN HATA", e.message); }
  // 3) UYAP e-Satis: ana sayfadaki linkler ve js'lerdeki istek adresleri
  try{ const { t } = await al("https://esatis.uyap.gov.tr/");
    console.log("\n### UYAP hrefler:", JSON.stringify(uniq((t.match(/href="([^"#]+)"/g) || []).map(x => x.slice(6, -1)).filter(x => !/\.(css|ico|png)/.test(x))).slice(0, 50)));
    console.log("ajax/url izleri:", JSON.stringify(uniq((t.match(/(url\s*:\s*["'][^"']+["']|["'][^"'\s]*\.(ajax|do|json|uyap)[^"'\s]*["'])/g) || [])).slice(0, 40)));
    const ic = (t.match(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g) || []).join("\n"); console.log("inline script ornek:", ic.replace(/\s+/g, " ").slice(0, 1500));
    for(const j of ["/theme/js/jquery/jq_util.js?v=3737"]){ const { t:J } = await al("https://esatis.uyap.gov.tr" + j); console.log(j, J.length, JSON.stringify(uniq((J.match(/["'][^"'\s]*\.(ajax|do|json)[^"'\s]*["']/g) || [])).slice(0, 20))); } }catch(e){ console.log("UYAP HATA", e.message); }
})();
