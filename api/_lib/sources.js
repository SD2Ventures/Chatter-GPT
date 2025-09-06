export const SOURCES = [
  // Reddit (no keys required)
  { type: "reddit-sub", id: "stocks" },
  { type: "reddit-sub", id: "wallstreetbets" },
  { type: "reddit-sub", id: "investing" },
  { type: "reddit-sub", id: "StockMarket" },
  { type: "reddit-sub", id: "options" },
  { type: "reddit-sub", id: "pennystocks" },
  { type: "reddit-sub", id: "valueinvesting" },
  { type: "reddit-sub", id: "smallstreetbets" },

  { type: "reddit-sub", id: "CryptoCurrency" },
  { type: "reddit-sub", id: "Bitcoin" },
  { type: "reddit-sub", id: "ethtrader" },
  { type: "reddit-sub", id: "CryptoMarkets" },
  { type: "reddit-sub", id: "CryptoCurrencyTrading" },

  // Finance/crypto home pages (HTML → text → symbols)
  { type: "html", url: "https://finance.yahoo.com/trending-tickers" },
  { type: "html", url: "https://www.coindesk.com/" },
  { type: "html", url: "https://cointelegraph.com/" }
];
