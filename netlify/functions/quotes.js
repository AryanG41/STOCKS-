// Netlify Function: /api/quotes?symbols=NVDA,VOO,FXAIX
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const MAX_SYMBOLS = 60;
const CONCURRENCY = 8;

async function fromYahoo(symbol) {
  const url = `${YAHOO}${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`yahoo ${res.status}`);
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  if (!r) throw new Error(json?.chart?.error?.description || "no result");
  const m = r.meta || {};
  const ts = r.timestamp || [];
  const closes = (r.indicators?.adjclose?.[0]?.adjclose) || (r.indicators?.quote?.[0]?.close) || [];
  const dates = [], vals = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !isFinite(c)) continue;
    dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
    vals.push(+c.toFixed(4));
  }
  if (!vals.length) throw new Error("empty series");
  return {
    symbol,
    name: m.longName || m.shortName || symbol,
    type: m.instrumentType || "",
    currency: m.currency || "USD",
    price: m.regularMarketPrice ?? vals[vals.length - 1],
    prevClose: m.chartPreviousClose ?? null,
    high52: m.fiftyTwoWeekHigh ?? null,
    low52: m.fiftyTwoWeekLow ?? null,
    marketTime: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
    dates, closes: vals, source: "yahoo",
  };
}

async function fromStooq(symbol) {
  const s = symbol.toLowerCase().replace(/\./g, "-") + ".us";
  const since = new Date(); since.setFullYear(since.getFullYear() - 1);
  const d1 = since.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://stooq.com/q/d/l/?s=${s}&d1=${d1}&i=d`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`stooq ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split("\n").slice(1);
  const dates = [], vals = [];
  for (const line of lines) {
    const [date, , , , close] = line.split(",");
    const c = parseFloat(close);
    if (!date || !isFinite(c)) continue;
    dates.push(date); vals.push(c);
  }
  if (!vals.length) throw new Error("stooq empty");
  return {
    symbol, name: symbol, type: "", currency: "USD",
    price: vals[vals.length - 1], prevClose: vals.length > 1 ? vals[vals.length - 2] : null,
    high52: Math.max(...vals), low52: Math.min(...vals), marketTime: null,
    dates, closes: vals, source: "stooq",
  };
}

async function fetchOne(symbol) {
  try { return await fromYahoo(symbol); }
  catch (e1) {
    try { return await fromStooq(symbol); }
    catch (e2) { return { symbol, error: `${e1.message}; ${e2.message}` }; }
  }
}

async function pool(items, worker, n) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx]); }
  }));
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("symbols") || "").toUpperCase();
  const symbols = [...new Set(raw.split(",").map(s => s.trim()).filter(s => /^[A-Z0-9.\-^=]{1,12}$/.test(s)))].slice(0, MAX_SYMBOLS);
  if (!symbols.length) {
    return new Response(JSON.stringify({ error: "pass ?symbols=NVDA,VOO" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const results = await pool(symbols, fetchOne, CONCURRENCY);
  const body = { fetchedAt: new Date().toISOString(), data: Object.fromEntries(results.map(r => [r.symbol, r])) };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
      "Netlify-CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
};

export const config = { path: "/api/quotes" };
