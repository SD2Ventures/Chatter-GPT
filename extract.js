// Symbol extraction utilities for US equities & common crypto
const EXCLUDE = new Set([
  "A","I","ME","ALL","ARE","FOR","SEE","PP","IT","ON","OR","DD","GO","USA",
  "WSB","IMO","YOLO","CEO","CFO","CTO","OTC","ETF","NAV","AI"
]);
const ALLOW_SHORT = new Set(["F","T","X","L","B","N","V","P"]);

const CRYPTO = new Set([
  "BTC","ETH","USDT","USDC","BNB","XRP","ADA","SOL","DOGE","DOT","MATIC",
  "LINK","LTC","BCH","XLM","ATOM","ARB","AVAX","SHIB","ETC","TON","APT","OP","PEPE"
]);

const R_CASHTAG = /\$[A-Za-z]{1,6}\b/g;
const R_UPPER    = /\b[A-Z]{1,5}\b/g;

export function extractSymbols(text) {
  if (!text) return [];
  const out = new Set();
  for (const m of text.matchAll(R_CASHTAG)) {
    const s = m[0].slice(1).toUpperCase();
    if (isCrypto(s) || isEquity(s)) out.add(s);
  }
  for (const m of text.matchAll(R_UPPER)) {
    const s = m[0].toUpperCase();
    if (isCrypto(s) || isEquity(s)) out.add(s);
  }
  return [...out];
}

function isCrypto(s){ return CRYPTO.has(s); }
function isEquity(s){
  if (s.length === 1 && !ALLOW_SHORT.has(s)) return false;
  if (EXCLUDE.has(s)) return false;
  return /^[A-Z]{1,5}$/.test(s);
}
