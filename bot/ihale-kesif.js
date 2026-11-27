// Ihale avcisi KESIF 5: ilan.gov.tr AdsByFilter dogru adres + govde denemeleri (sadece okur)
const UA = { "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", "Accept-Language":"tr-TR,tr;q=0.9", Origin:"https://www.ilan.gov.tr", Referer:"https://www.ilan.gov.tr/" };
const API = "https://www.ilan.gov.tr/api/api/services/app";
const dene = async (yol, govde, yontem = "POST") => { const r = await fetch(API + yol, { method:yontem, headers:{ ...UA, "Content-Type":"application/json-patch+json", Accept:"text/plain" }, body:yontem === "POST" ? JSON.stringify(govde) : undefined }); const t = await r.text(); console.log(`\n${yontem} ${yol} ${JSON.stringify(govde || "")} -> ${r.status}\n${t.slice(0, 1800)}`); return t; };
(async () => {
  try{ await dene("/AdHomePage/GetCategoryByStats", null, "GET"); }catch(e){ console.log("HATA", e.message); }
  for(const g of [{}, { keys:{}, skipCount:0, maxResultCount:3 }, { keys:{ q:["tarla"] }, skipCount:0, maxResultCount:3 }, { searchText:"tarla", skipCount:0, maxResultCount:3 }]){ try{ await dene("/Ad/AdsByFilter", g); }catch(e){ console.log("HATA", e.message); } }
})();
