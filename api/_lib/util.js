const CRYPTO_SET = new Set([
  "BTC","ETH","SOL","XRP","ADA","DOGE","SHIB","AVAX","BNB",
  "MATIC","DOT","LTC","LINK","ATOM","NEAR","APT","SUI","ARB",
  "OP","BCH","ETC"
]);

export function isCrypto(sym){ return CRYPTO_SET.has(sym); }

export function extractCashtags(text){
  if(!text) return [];
  const re = /(^|\s)\$([A-Z]{1,6})(?=\b)/g;
  const out = new Set(); let m;
  while((m = re.exec((text||'').toUpperCase()))!==null) out.add(m[2]);
  return Array.from(out);
}

const COIN_NAME = {BTC:"Bitcoin",ETH:"Ethereum",SOL:"Solana",XRP:"XRP",ADA:"Cardano",DOGE:"Dogecoin",SHIB:"Shiba Inu",AVAX:"Avalanche",BNB:"BNB",MATIC:"Polygon",DOT:"Polkadot",LTC:"Litecoin",LINK:"Chainlink",ATOM:"Cosmos",NEAR:"NEAR",APT:"Aptos",SUI:"Sui",ARB:"Arbitrum",OP:"Optimism",BCH:"Bitcoin Cash",ETC:"Ethereum Classic"};

export function prettyName(domain, sym){
  if(domain === 'crypto' && COIN_NAME[sym]) return COIN_NAME[sym];
  return sym;
}

export function clamp(x, lo, hi){ return Math.max(lo, Math.min(hi, x)); }

export function scoreFromZ(z, evidenceCount = 0, eventBoost = 0){
  const base = 50 + 20*z;
  return clamp(Math.round(base + evidenceCount*5 + eventBoost), 0, 100);
}
