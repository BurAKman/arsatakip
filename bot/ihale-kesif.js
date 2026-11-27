// Ihale avcisi KESIF: GitHub sunucusundan resmi ihale sitelerine erisilebiliyor mu? (sadece okur, hicbir yere yazmaz)
const UA = { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", "Accept-Language":"tr-TR,tr;q=0.9" };
const HEDEF = [
  ["UYAP e-Satis ana", "https://esatis.uyap.gov.tr/"],
  ["UYAP e-Satis ilan", "https://esatis.uyap.gov.tr/main/jsp/esatis/index.jsp"],
  ["ilan.gov.tr ana", "https://www.ilan.gov.tr/"],
  ["ilan.gov.tr icra", "https://www.ilan.gov.tr/ilan/kategori/9/icra-ve-iflas-mudurlukleri"],
  ["Milli Emlak ihale", "https://www.turkiye.gov.tr/csb-tasinmaz-satis-ilanlari-ihaleye-cikanlar"],
  ["Milli Emlak satisa hazirlanan", "https://www.turkiye.gov.tr/csb-satis-ilanlari-satisa-hazirlananlar"] ];
(async () => { for(const [ad, url] of HEDEF){ try{ const r = await fetch(url, { headers:UA, redirect:"follow" }); const t = await r.text();
    const api = [...new Set((t.match(/["'](\/[a-zA-Z0-9_\-\/]*(api|service|ajax|ilan|satis|search|ara)[a-zA-Z0-9_\-\/\.]*)["']/gi) || []).map(x => x.slice(1, -1)))].slice(0, 25);
    const scr = [...new Set((t.match(/src=["']([^"']+\.js[^"']*)["']/gi) || []).map(x => x.replace(/^src=["']|["']$/g, "")))].slice(0, 10);
    console.log(`\n### ${ad}\nURL ${url} -> ${r.status} ${r.url}\nuzunluk ${t.length} · captcha:${/captcha|recaptcha|hcaptcha|cf-chl|cloudflare/i.test(t)} · tablo:${(t.match(/<tr/gi) || []).length} · Tarla:${(t.match(/Tarla/g) || []).length}`);
    console.log("api izleri:", JSON.stringify(api)); console.log("scriptler:", JSON.stringify(scr));
    console.log("ornek:", t.replace(/\s+/g, " ").replace(/<script[\s\S]*?<\/script>/gi, "").slice(0, 600));
    const tab = t.match(/<table[\s\S]*?<\/table>/i); if(tab) console.log("ilk tablo:", tab[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 900));
  }catch(e){ console.log(`\n### ${ad}\nHATA ${e.message}`); } } })();
