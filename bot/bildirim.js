// ARSA TAKIP · telefona anlik bildirim (Web Push, RFC 8291 aes128gcm + VAPID). Disaridan paket yok, sadece Node'un kendi crypto'su.
// Anahtar cifti ilk calismada bot tarafindan uretilir ve Supabase'de sadece servis anahtarinin okuyabildigi tabloda (bildirim_anahtar) saklanir.
"use strict";
const crypto = require("crypto");
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uDec = s => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

function vapidUret(){ const e = crypto.createECDH("prime256v1"); e.generateKeys(); const pub = e.getPublicKey();
  return { pub:b64u(pub), jwk:{ kty:"EC", crv:"P-256", x:b64u(pub.subarray(1, 33)), y:b64u(pub.subarray(33, 65)), d:b64u(e.getPrivateKey()) } }; }
function vapidBaslik(endpoint, V, konu){ const aud = new URL(endpoint).origin, h = b64u(JSON.stringify({ typ:"JWT", alg:"ES256" })), p = b64u(JSON.stringify({ aud, exp:Math.floor(Date.now()/1000) + 12*3600, sub:konu || "mailto:arsatakip@example.com" }));
  const key = crypto.createPrivateKey({ key:V.jwk, format:"jwk" }), imza = crypto.sign("sha256", Buffer.from(h + "." + p), { key, dsaEncoding:"ieee-p1363" });
  return `vapid t=${h}.${p}.${b64u(imza)}, k=${V.pub}`; }
// RFC 8291: icerigi alicinin (telefonun) anahtariyla sifrele
function sifrele(yuk, p256dh, auth){ const ua = b64uDec(p256dh), sec = b64uDec(auth), e = crypto.createECDH("prime256v1"); e.generateKeys(); const as = e.getPublicKey(), ecdh = e.computeSecret(ua);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", ecdh, sec, Buffer.concat([Buffer.from("WebPush: info\0"), ua, as]), 32)), tuz = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, tuz, Buffer.from("Content-Encoding: aes128gcm\0"), 16)), nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, tuz, Buffer.from("Content-Encoding: nonce\0"), 12));
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce), govde = Buffer.concat([c.update(Buffer.concat([Buffer.from(yuk), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const bas = Buffer.alloc(21); tuz.copy(bas, 0); bas.writeUInt32BE(4096, 16); bas[20] = as.length; return Buffer.concat([bas, as, govde]); }
async function gonder(abone, veri, V){ const govde = sifrele(JSON.stringify(veri), abone.p256dh, abone.auth);
  const r = await fetch(abone.endpoint, { method:"POST", headers:{ Authorization:vapidBaslik(abone.endpoint, V), "Content-Encoding":"aes128gcm", "Content-Type":"application/octet-stream", TTL:"86400", Urgency:veri.acil ? "high" : "normal" }, body:govde });
  return r.status; }
module.exports = { vapidUret, vapidBaslik, sifrele, gonder, b64u, b64uDec };
