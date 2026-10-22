// TCMB'den (Turkiye Cumhuriyet Merkez Bankasi) doviz kurlarini ceken modul -
// Code.gs'deki getTcmbRates_/convertCurrency_ ile AYNI mantik, Node.js'e port edilmis.
// XmlService yerine basit regex ile parse ediyoruz (TCMB'nin XML yapisi sabit ve basit).

const cache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 21600 saniye = 6 saat, Apps Script'teki ile ayni

function pad2(n) { return String(n).padStart(2, '0'); }

async function fetchRatesForDate(tryDate) {
  const dd = pad2(tryDate.getDate()) + pad2(tryDate.getMonth() + 1) + tryDate.getFullYear();
  const yyyymm = tryDate.getFullYear() + pad2(tryDate.getMonth() + 1);
  const url = `https://www.tcmb.gov.tr/kurlar/${yyyymm}/${dd}.xml`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const xml = await res.text();
    const rates = {};
    // <Currency CurrencyCode="USD">...<ForexSelling>32,1234</ForexSelling>...</Currency>
    const currencyBlocks = xml.match(/<Currency[^>]*CurrencyCode="([A-Z]{3})"[\s\S]*?<\/Currency>/g) || [];
    currencyBlocks.forEach((block) => {
      const codeMatch = block.match(/CurrencyCode="([A-Z]{3})"/);
      const sellingMatch = block.match(/<ForexSelling>([^<]*)<\/ForexSelling>/);
      if (codeMatch && sellingMatch) {
        const selling = parseFloat(sellingMatch[1].replace(',', '.'));
        if (selling) rates[codeMatch[1]] = selling;
      }
    });
    return rates.USD ? rates : null;
  } catch (e) {
    return null;
  }
}

// Code.gs'deki gibi: istenen tarihten geriye dogru 8 gune kadar dener
// (hafta sonu/resmi tatil gunleri TCMB yayin yapmaz).
async function getTcmbRates(dateStr) {
  if (!dateStr) return null;
  const cacheKey = 'tcmb_' + dateStr;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) return cached.rates;

  const baseDate = new Date(dateStr);
  if (isNaN(baseDate.getTime())) return null;

  for (let i = 0; i < 8; i++) {
    const tryDate = new Date(baseDate);
    tryDate.setDate(baseDate.getDate() - i);
    const rates = await fetchRatesForDate(tryDate);
    if (rates) {
      cache.set(cacheKey, { rates, time: Date.now() });
      return rates;
    }
  }
  return null;
}

async function convertCurrency(amount, currency, dateStr, targetCur) {
  if (!amount) return null;
  amount = Number(amount);
  if (isNaN(amount)) return null;
  const cur = currency || 'TRY';
  if (cur === targetCur) return amount;

  const today = new Date().toISOString().slice(0, 10);
  const rates = (await getTcmbRates(dateStr)) || (await getTcmbRates(today));
  if (!rates || !rates.USD) return null;

  let inTRY;
  if (cur === 'TRY') inTRY = amount;
  else if (rates[cur]) inTRY = amount * rates[cur];
  else return null;

  if (targetCur === 'TRY') return inTRY;
  if (targetCur === 'USD') return inTRY / rates.USD;
  if (rates[targetCur]) return inTRY / rates[targetCur];
  return null;
}

// Envanter listesine, her varligin fiyatinin SATIN ALMA TARIHINDEKI resmi kurla
// USD/TRY/RUB karsiligini ekler - Code.gs'deki enrichWithUsd_ ile ayni.
async function enrichWithUsd(items) {
  for (const a of items) {
    if (a.Fiyat) {
      const dateStr = a.SatinAlmaTarihi || a.OlusturmaTarihi;
      const usd = await convertCurrency(a.Fiyat, a.ParaBirimi, dateStr, 'USD');
      const tryVal = await convertCurrency(a.Fiyat, a.ParaBirimi, dateStr, 'TRY');
      const rub = await convertCurrency(a.Fiyat, a.ParaBirimi, dateStr, 'RUB');
      a.FiyatUSD = usd !== null ? Math.round(usd * 100) / 100 : '';
      a.FiyatTRY = tryVal !== null ? Math.round(tryVal * 100) / 100 : '';
      a.FiyatRUB = rub !== null ? Math.round(rub * 100) / 100 : '';
    } else {
      a.FiyatUSD = '';
      a.FiyatTRY = '';
      a.FiyatRUB = '';
    }
  }
  return items;
}

// Her kullanilan TCMB kurunu, tarih bazinda ayri bir "KurGecmisi" sekmesine
// kaydeder - Code.gs'deki logKurGecmisi_/getAndLogExchangeRate_ ile ayni.
async function logKurGecmisi(dateStr, rateValues) {
  const sheets = require('./sheets');
  const headers = ['Tarih', 'USD', 'EUR', 'RUB', 'Kaynak', 'KayitZamani'];
  const rows = await sheets.getSheetValues('KurGecmisi');
  if (rows.length >= 2) {
    const existingDates = rows.slice(1).map((r) => String(r[0]));
    if (existingDates.indexOf(dateStr) !== -1) return;
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  await sheets.appendRow('KurGecmisi', [dateStr, rateValues.USD || '', rateValues.EUR || '', rateValues.RUB || '', 'TCMB (T.C. Merkez Bankasi)', nowStr]);
}

async function getAndLogExchangeRate(dateStr) {
  const r = await getTcmbRates(dateStr);
  if (r) await logKurGecmisi(dateStr, r);
  return r || {};
}

module.exports = { getTcmbRates, convertCurrency, enrichWithUsd, getAndLogExchangeRate };
