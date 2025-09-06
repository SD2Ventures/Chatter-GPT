import * as cheerio from "cheerio";

export function visibleText(html) {
  const $ = cheerio.load(html);
  $("script,style,noscript,svg,nav,footer,header,aside").remove();
  return $("body").text().replace(/\s+/g," ").trim();
}
