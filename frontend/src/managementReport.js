// Yönetim Raporu - 3 sayfalı, filtre edilebilir, filtreye göre otomatik
// yeniden hesaplanan (Excel'in SUBTOTAL fonksiyonu ile) ve grafik iceren
// bir Excel dosyası üretir. Secili UI diline (TR/RU/EN) göre TÜM basliklar
// çevrilir - export'un dil eksikligi olan eski hali degil.
import ExcelJS from 'exceljs';

// ---- Basit, bagimsiz (kutuphanesiz) canvas bar-grafik uretici ----
// Not: Bu grafik STATIK bir goruntudur - Excel'de filtre degistirince
// otomatik guncellenmez (native Excel grafikleri ExcelJS'te guvenilir
// desteklenmiyor). KPI tablolari (SUBTOTAL formulleri) filtreyle guncellenir,
// grafik ise raporun olusturuldugu andaki genel dagilimi gosterir.
// valueFormatter: bar ustundeki deger etiketini nasil yazdiracagini belirler
// (orn. para birimi icin "$1,234" - verilmezse ham sayi yazilir).
function renderBarChartPNG(labels, values, title, color, valueFormatter) {
  const canvas = document.createElement('canvas');
  const W = 680, H = 340;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 14, 22);

  const padding = { top: 40, right: 16, bottom: 76, left: 34 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const maxVal = Math.max(1, ...values);
  const n = Math.max(1, labels.length);
  const barGap = 10;
  const barW = Math.max(8, (chartW - barGap * (n - 1)) / n);
  const fmt = valueFormatter || ((v) => String(v));

  ctx.strokeStyle = '#d0d0d8';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.stroke();

  labels.forEach((label, i) => {
    const val = values[i] || 0;
    const barH = (val / maxVal) * chartH;
    const x = padding.left + i * (barW + barGap);
    const y = padding.top + chartH - barH;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fmt(val), x + barW / 2, y - 4);
    ctx.save();
    ctx.translate(x + barW / 2, padding.top + chartH + 8);
    ctx.rotate(-Math.PI / 5);
    ctx.textAlign = 'right';
    ctx.font = '10px Arial, sans-serif';
    const shortLabel = label.length > 20 ? label.slice(0, 18) + '…' : label;
    ctx.fillText(shortLabel, 0, 0);
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

// ---- Bar (o ayin kendi degeri) + kirmizi cizgi (kumulatif toplam) kombine
// grafik - iki ayri olcek kullanir (barlar solda kendi max'ina, cizgi sagda
// kendi max'ina gore olceklenir) ki kumulatif toplam barlari gorunmez
// kilmasin. valueFormatter para birimi etiketleri icin kullanilir. ----
function renderComboChartPNG(labels, barValues, lineValues, title, barColor, valueFormatter, barLabel, lineLabel) {
  const canvas = document.createElement('canvas');
  const W = 680, H = 340;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 14, 22);

  const padding = { top: 40, right: 16, bottom: 76, left: 34 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const maxBar = Math.max(1, ...barValues);
  const maxLine = Math.max(1, ...lineValues);
  const n = Math.max(1, labels.length);
  const barGap = 10;
  const barW = Math.max(8, (chartW - barGap * (n - 1)) / n);
  const fmt = valueFormatter || ((v) => String(v));

  ctx.strokeStyle = '#d0d0d8';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.stroke();

  // Barlar (o ayin kendi degeri)
  const points = [];
  labels.forEach((label, i) => {
    const val = barValues[i] || 0;
    const barH = (val / maxBar) * chartH * 0.85; // cizgiye yer birak diye biraz kisiltiyoruz
    const x = padding.left + i * (barW + barGap);
    const y = padding.top + chartH - barH;
    ctx.fillStyle = barColor;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y, barW, barH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fmt(val), x + barW / 2, y - 4);

    const lineVal = lineValues[i] || 0;
    const lineY = padding.top + chartH - (lineVal / maxLine) * chartH;
    points.push({ x: x + barW / 2, y: lineY });

    ctx.save();
    ctx.translate(x + barW / 2, padding.top + chartH + 8);
    ctx.rotate(-Math.PI / 5);
    ctx.textAlign = 'right';
    ctx.font = '10px Arial, sans-serif';
    const shortLabel = label.length > 20 ? label.slice(0, 18) + '…' : label;
    ctx.fillText(shortLabel, 0, 0);
    ctx.restore();
  });

  // Kumulatif toplam - kirmizi cizgi
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.stroke();
  points.forEach((p) => {
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // Her noktadaki kumulatif toplami goster (sadece son nokta degil)
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.textAlign = 'center';
  points.forEach((p, i) => {
    const val = lineValues[i] || 0;
    ctx.fillText(fmt(val), p.x, p.y - 8);
  });

  // Ufak bir gosterge (legend)
  ctx.fillStyle = barColor;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(padding.left, 28, 10, 10);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(barLabel || '', padding.left + 14, 37);
  const barLabelW = ctx.measureText(barLabel || '').width;
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left + 14 + barLabelW + 14, 33);
  ctx.lineTo(padding.left + 14 + barLabelW + 26, 33);
  ctx.stroke();
  ctx.fillStyle = '#6b7280';
  ctx.fillText(lineLabel || '', padding.left + 14 + barLabelW + 32, 37);

  return canvas.toDataURL('image/png');
}

// Ise baslama (yesil) ile isten ayrilma (kirmizi) çubuklarini AY BAZINDA yan
// yana, ustunde de NET kumulatif degisimi (kac kisi calisiyor trendini) mavi
// bir cizgiyle gosteren grafik - "kac kisi giriyor kac kisi cikiyor" sorusuna
// TEK grafikte cevap verir.
function renderHiresDeparturesChartPNG(labels, hireValues, departureValues, cancelValues, pendingValues, baselineCount, title, hireLabel, departureLabel, cancelLabel, pendingLabel, netLabel) {
  const canvas = document.createElement('canvas');
  const W = 680, H = 340;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, 14, 22);

  const padding = { top: 54, right: 16, bottom: 76, left: 34 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const maxBar = Math.max(1, ...hireValues, ...departureValues, ...cancelValues, ...pendingValues);
  const netValues = [];
  let running = baselineCount || 0;
  for (let i = 0; i < labels.length; i++) { running += (hireValues[i] || 0) - (departureValues[i] || 0); netValues.push(running); }
  const maxNetAbs = Math.max(1, ...netValues.map((v) => Math.abs(v)));
  const n = Math.max(1, labels.length);
  const groupGap = 10;
  const groupW = (chartW - groupGap * (n - 1)) / n;
  const barW = groupW / 4 - 2;

  ctx.strokeStyle = '#d0d0d8';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, padding.top + chartH);
  ctx.lineTo(padding.left + chartW, padding.top + chartH);
  ctx.stroke();

  const points = [];
  labels.forEach((label, i) => {
    const groupX = padding.left + i * (groupW + groupGap);
    const hireH = ((hireValues[i] || 0) / maxBar) * chartH * 0.8;
    const depH = ((departureValues[i] || 0) / maxBar) * chartH * 0.8;
    const cancelH = ((cancelValues[i] || 0) / maxBar) * chartH * 0.8;
    const pendingH = ((pendingValues[i] || 0) / maxBar) * chartH * 0.8;

    ctx.fillStyle = '#16a34a';
    ctx.fillRect(groupX, padding.top + chartH - hireH, barW, hireH);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(groupX + barW + 3, padding.top + chartH - depH, barW, depH);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(groupX + (barW + 3) * 2, padding.top + chartH - cancelH, barW, cancelH);
    ctx.fillStyle = '#9333ea';
    ctx.fillRect(groupX + (barW + 3) * 3, padding.top + chartH - pendingH, barW, pendingH);

    ctx.fillStyle = '#1a1a2e';
    ctx.font = '9px Arial, sans-serif';
    ctx.textAlign = 'center';
    if (hireValues[i]) ctx.fillText(String(hireValues[i]), groupX + barW / 2, padding.top + chartH - hireH - 4);
    if (departureValues[i]) ctx.fillText(String(departureValues[i]), groupX + barW + 3 + barW / 2, padding.top + chartH - depH - 4);
    if (cancelValues[i]) ctx.fillText(String(cancelValues[i]), groupX + (barW + 3) * 2 + barW / 2, padding.top + chartH - cancelH - 4);
    if (pendingValues[i]) ctx.fillText(String(pendingValues[i]), groupX + (barW + 3) * 3 + barW / 2, padding.top + chartH - pendingH - 4);

    // Net kumulatif deger - 0 cizgisini ortada varsayip (+ yukari, - asagi) olceklendiriyoruz
    const netY = padding.top + chartH / 2 - (netValues[i] / maxNetAbs) * (chartH / 2 * 0.85);
    points.push({ x: groupX + groupW / 2, y: netY });

    ctx.save();
    ctx.translate(groupX + groupW / 2, padding.top + chartH + 8);
    ctx.rotate(-Math.PI / 5);
    ctx.textAlign = 'right';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 4]); // kesikli cizgi - bar renklerinden ayirt edilsin diye
  ctx.beginPath();
  points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.stroke();
  ctx.setLineDash([]); // sonraki cizimler (nokta, metin vb.) etkilenmesin diye sifirla
  points.forEach((p, i) => {
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Sayinin altina beyaz bir "etiket kutusu" koyup cubuk sayilariyla
    // karismamasini sagliyoruz - net toplam degeri HER ZAMAN net okunsun diye.
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.textAlign = 'center';
    const label = String(netValues[i]);
    const labelW = ctx.measureText(label).width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - labelW / 2 - 4, p.y - 22, labelW + 8, 15);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - labelW / 2 - 4, p.y - 22, labelW + 8, 15);
    ctx.fillStyle = '#2563eb';
    ctx.fillText(label, p.x, p.y - 11);
  });

  // Gosterge (legend) - iki satira boluyoruz, 5 oge tek satira sigmiyor
  ctx.font = '10px Arial, sans-serif';
  ctx.textAlign = 'left';
  let lx = padding.left;
  ctx.fillStyle = '#16a34a'; ctx.fillRect(lx, 28, 10, 10);
  ctx.fillStyle = '#6b7280'; ctx.fillText(hireLabel, lx + 14, 37);
  lx += 14 + ctx.measureText(hireLabel).width + 16;
  ctx.fillStyle = '#dc2626'; ctx.fillRect(lx, 28, 10, 10);
  ctx.fillStyle = '#6b7280'; ctx.fillText(departureLabel, lx + 14, 37);
  lx += 14 + ctx.measureText(departureLabel).width + 16;
  ctx.fillStyle = '#eab308'; ctx.fillRect(lx, 28, 10, 10);
  ctx.fillStyle = '#6b7280'; ctx.fillText(cancelLabel, lx + 14, 37);
  // 4. ogeden itibaren tasma riski var - ikinci satira geciyoruz
  let lx2 = padding.left;
  ctx.fillStyle = '#9333ea'; ctx.fillRect(lx2, 42, 10, 10);
  ctx.fillStyle = '#6b7280'; ctx.fillText(pendingLabel, lx2 + 14, 51);
  lx2 += 14 + ctx.measureText(pendingLabel).width + 16;
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2;
  ctx.setLineDash([4, 2]);
  ctx.beginPath(); ctx.moveTo(lx2, 47); ctx.lineTo(lx2 + 12, 47); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#6b7280'; ctx.fillText(netLabel, lx2 + 18, 51);

  return canvas.toDataURL('image/png');
}

// Google Sheets'ten gelen tarih hucreleri bazen ISO (yyyy-MM-dd), bazen
// yerel (dd.MM.yyyy) formatinda gelebiliyor - JS'in yerli Date() ayristiricisi
// ikincisini GUVENILIR sekilde okuyamiyor (bazen NaN doner, kayit sessizce
// kaybolur). HR senkronundaki normalizeDateStr_ ile AYNI mantikla, ikisini
// de once dener, olmazsa native Date()'e duser.
function parseFlexDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const dmyMatch = s.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dmyMatch) {
    const d = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function countBy(items, field, translateFn) {
  const counts = {};
  items.forEach((it) => {
    const key = translateFn ? translateFn(it[field]) : (it[field] || '—');
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
}

// Tum para birimi gosterimlerinde AYNI stil: "$1,234" (bin ayirici virgul, $ onek).
function fmtUSD(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// Departman adlari genelde "Rusca/Turkce" seklinde cok uzun bilingual metinler
// - grafik etiketi icin secili dile uygun YARISINI alip kisaltir.
function shortDeptLabel(dept, lang) {
  if (!dept) return dept;
  const parts = dept.split('/');
  if (parts.length < 2) return dept;
  const hasCyrillic = (s) => /[а-яА-ЯёЁ]/.test(s);
  let chosen;
  if (lang === 'ru') chosen = parts.find((p) => hasCyrillic(p)) || parts[0];
  else chosen = parts.find((p) => !hasCyrillic(p)) || parts[parts.length - 1];
  return chosen.trim();
}

// Aylik deger dizisini KUMULATIF (o aya kadarki toplam) diziye cevirir.
function toCumulative(values) {
  let running = 0;
  return values.map((v) => { running += v; return running; });
}

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2A44' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
const TITLE_FONT = { bold: true, size: 16, color: { argb: 'FF1F2A44' } };
const KPI_LABEL_FONT = { size: 10, color: { argb: 'FF6B7280' } };
const KPI_VALUE_FONT = { bold: true, size: 14, color: { argb: 'FF1F2A44' } };
const ACCENT = 'FF2F6FED';

function styleHeaderRow(row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  row.height = 20;
}

function addKpiCard(ws, row, col, label, formulaOrValue, isFormula, numFmt) {
  const labelCell = ws.getCell(row, col);
  labelCell.value = label;
  labelCell.font = KPI_LABEL_FONT;
  const valueCell = ws.getCell(row + 1, col);
  if (isFormula) valueCell.value = { formula: formulaOrValue };
  else valueCell.value = formulaOrValue;
  valueCell.font = KPI_VALUE_FONT;
  if (numFmt) valueCell.numFmt = numFmt;
}

export async function exportManagementReport({ items, needs, employees, rates, t, lang, translateCategory, translateStatus }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'STS Envanter';
  wb.created = new Date();
  // Excel'in dosyayi actiginda TUM formulleri otomatik yeniden hesaplamasini
  // zorluyoruz - bazi durumlarda (hesaplama modu "Elle" ayarliysa vb.)
  // formul hucreleri bos/0 gorunebiliyordu, bu bunu onler.
  wb.calcProperties = { fullCalcOnLoad: true };

  const todayStr = new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'tr-TR');

  // ============================================================
  // SAYFA 0 - YONETICI OZETI (surpriz sayfa - ilk acilan sekme)
  // ============================================================
  // Bu sayfa, digerlerinin aksine HAM VERIYI degil, o veriden CIKARILAN
  // ICGORULERI gosterir: departman bazli harcama, cihaz yas dagilimi,
  // yenileme onerisi ve otomatik olusturulan anlatı cumleleri. Tamamen bu
  // export calistirildigi andaki anlik durumu yansitir (Excel'de filtre
  // degisince guncellenmez - diger sayfalardaki SUBTOTAL kartlarindan farkli
  // olarak, bu bir "yonetici brifingi", canli bir hesap tablosu degil).
  const wsExec = wb.addWorksheet(t('mgmt_report_exec_title'), { views: [{ state: 'frozen', ySplit: 0 }] });
  wsExec.getColumn(1).width = 3;
  wsExec.mergeCells('B2:K2');
  wsExec.getCell('B2').value = t('mgmt_report_exec_title');
  wsExec.getCell('B2').font = { ...TITLE_FONT, size: 20 };
  wsExec.mergeCells('B3:K3');
  wsExec.getCell('B3').value = t('mgmt_report_generated_on') + ': ' + todayStr;
  wsExec.getCell('B3').font = { size: 10, color: { argb: 'FF6B7280' } };

  // ---- Yardimci hesaplamalar (departman haritasi, yas, harcama) ----
  const deptByName = {};
  employees.forEach((e) => { deptByName[e.AdSoyad] = e.Departman; });

  const totalTRY = items.reduce((s, a) => s + (Number(a.FiyatTRY) || 0), 0);
  // STS-Akkuyu disindaki (merkezden/baska firmadan gelip yine de BT ekipmani
  // alan) kisiler "aktif calisan" SAYISINA dahil edilmez - ama envanter/
  // ihtiyac takibi onlar icin de aynen devam eder, sadece bu ozet sayida
  // AYRI gosterilirler ki gercek personel sayisi sasirtici cikmasin.
  const isStsAkkuyu = (e) => !e.Firma || e.Firma === 'STS-Akkuyu';
  const currentActiveCount = employees.filter((e) => e.AktifMi === 'Aktif' && isStsAkkuyu(e)).length;
  const otherCompanyActiveCount = employees.filter((e) => e.AktifMi === 'Aktif' && !isStsAkkuyu(e)).length;
  // "Tum secenekleri" (Aktif/Beklemede/Pasif/Iptal) tek bakista gosteren ozet.
  const statusCounts = { Aktif: 0, Beklemede: 0, Pasif: 0, Iptal: 0 };
  employees.forEach((e) => { if (statusCounts[e.AktifMi] !== undefined) statusCounts[e.AktifMi]++; });

  // ---- Veri Butunlugu Kontrolu: eksik alanlar rapor sayilarini sessizce
  // saptirabiliyor (orn. Iptal Tarihi girilmemis biri grafikte hic
  // gorunmez) - bu yuzden kac kisinin gerekli bir alani eksik oldugunu
  // rapora da yaziyoruz, sadece Panel'de degil. ----
  let dataGapsCount = 0;
  employees.forEach((e) => {
    if (!e.AdSoyad) return;
    if ((e.AktifMi === 'Pasif' || e.AktifMi === 'Iptal') && !e.IstenAyrilmaTarihi) dataGapsCount++;
    if (e.AktifMi === 'Beklemede' && !e.PlanlananBaslangicTarihi) dataGapsCount++;
    if ((e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && !e.SicilNo) dataGapsCount++;
  });

  const totalUSD = items.reduce((s, a) => s + (Number(a.FiyatUSD) || 0), 0);
  const totalRUB = items.reduce((s, a) => s + (Number(a.FiyatRUB) || 0), 0);

  const spendByCategory = {};
  const spendByDept = {};
  const now = new Date();

  items.forEach((a) => {
    const usd = Number(a.FiyatUSD) || 0;
    const cat = translateCategory(a.Kategori, lang);
    spendByCategory[cat] = (spendByCategory[cat] || 0) + usd;
    const dept = a.AtananKisi ? (deptByName[a.AtananKisi] || t('mgmt_report_no_dept')) : t('mgmt_report_no_dept');
    if (usd > 0) spendByDept[dept] = (spendByDept[dept] || 0) + usd;
  });

  // ---- Aylik buyume trendi: her ay kac cihaz envantere eklendi VE ne kadar
  // harcandi (KUMULATIF - her ay o aya kadarki TOPLAMI gosterir, sadece o
  // ayin kendi degerini degil - buyume hikayesini daha iyi anlatir) -----
  // (Yas dagilimi/yenileme onerisi yerine - proje/envanter cok yeni oldugu
  // icin "3+ yil kullanimda" gibi bir metrik henuz anlamli degil; bunun
  // yerine sirketin ne hizla buyudugunu gostermek daha anlamli.)
  const monthlyGrowth = {};
  const monthlySpend = {};
  let last30dCount = 0;
  const in30dAgo = new Date(); in30dAgo.setDate(in30dAgo.getDate() - 30);
  items.forEach((a) => {
    const dateStr = a.SatinAlmaTarihi || a.OlusturmaTarihi;
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyGrowth[key] = (monthlyGrowth[key] || 0) + 1;
    monthlySpend[key] = (monthlySpend[key] || 0) + (Number(a.FiyatUSD) || 0);
    if (d >= in30dAgo && d <= now) last30dCount++;
  });
  const monthKeys = Object.keys(monthlyGrowth).sort();

  // ---- Aylik ise baslama trendi (Calisanlar > Ise Baslama Tarihi, HR'dan) - KUMULATIF ----
  // NOT: "Su an aktif calisan sayisi" (currentActiveCount) SADECE STS-Akkuyu'yu
  // saydigi icin, bu grafik de AYNI kapsamda (isStsAkkuyu) filtrelenir -
  // yoksa kumulatif cizginin sonu o sayiyla eslesmez.
  const monthlyHires = {};
  let last30dHires = 0;
  employees.forEach((e) => {
    if (!isStsAkkuyu(e)) return;
    // "Gercekten baslamis" sayilanlar: su an Aktif OLANLAR + daha once
    // baslayip sonra ayrilmis (Pasif) olanlar - ikisi de bir zamanlar
    // GERCEKTEN ise girmis demektir, bu yuzden "hire" olarak sayilmalilar
    // (departure ayrica DUSULUYOR zaten, iki olay birlikte doGru net
    // etkiyi verir). SADECE Beklemede/Iptal DISLANIYOR - onlar HENUZ/HIC
    // gercekten baslamadi, tarih alani erken doldurulmus olsa bile.
    if (e.AktifMi !== 'Aktif' && e.AktifMi !== 'Pasif') return;
    if (!e.IseBaslamaTarihi) return;
    const d = parseFlexDate(e.IseBaslamaTarihi);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyHires[key] = (monthlyHires[key] || 0) + 1;
    if (d >= in30dAgo && d <= now) last30dHires++;
  });

  // ---- Aylik isten ayrilma trendi (Calisanlar > Isten Ayrilma Tarihi, HR'dan) ----
  const monthlyDepartures = {};
  let last30dDepartures = 0;
  employees.forEach((e) => {
    if (!isStsAkkuyu(e)) return;
    // Sadece GERCEK ayrilanlari sayiyoruz (AktifMi='Pasif') - hicbir zaman
    // baslamadan girisi iptal olanlar (AktifMi='Iptal') burada SAYILMAZ,
    // cunku onlar gercek bir "ayrilma" degil, hic gerceklesmemis bir
    // ise alim - karistirilmasinlar diye ayri tutuluyor.
    if (e.AktifMi !== 'Pasif') return;
    if (!e.IstenAyrilmaTarihi) return;
    const d = parseFlexDate(e.IstenAyrilmaTarihi);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyDepartures[key] = (monthlyDepartures[key] || 0) + 1;
    if (d >= in30dAgo && d <= now) last30dDepartures++;
  });

  // ---- Aylik iptal trendi (AktifMi='Iptal' - hic baslamadan girisi iptal
  // olanlar). Ayni Isten Ayrilma Tarihi alani, "bu statu ne zaman verildi"
  // anlaminda burada da kullanilir. Ayri tutulur ki gercek ayrilmalarla
  // karismasin - ama raporda ucuncu bir (sari) cubuk olarak gosterilir. ----
  const monthlyCancellations = {};
  employees.forEach((e) => {
    if (!isStsAkkuyu(e)) return;
    if (e.AktifMi !== 'Iptal') return;
    if (!e.IstenAyrilmaTarihi) return;
    const d = parseFlexDate(e.IstenAyrilmaTarihi);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyCancellations[key] = (monthlyCancellations[key] || 0) + 1;
  });

  // ---- Aylik "Beklemede" (henuz baslamamis, planlanan) trendi - Planlanan
  // Baslangic Tarihi'ne gore. GELECEGE DONUK bir gosterge oldugu icin net
  // kumulatif toplama DAHIL EDILMEZ (henuz gercek bir baslama degil,
  // sadece "bu ay kac kisinin baslamasi planlaniyor" bilgisini verir). ----
  const monthlyPending = {};
  employees.forEach((e) => {
    if (!isStsAkkuyu(e)) return;
    if (e.AktifMi !== 'Beklemede') return;
    if (!e.PlanlananBaslangicTarihi) return;
    const d = parseFlexDate(e.PlanlananBaslangicTarihi);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyPending[key] = (monthlyPending[key] || 0) + 1;
  });

  // Iki tarafin da (ise baslama + ayrilma) gordugu TUM aylari birlestirip
  // ortak, sirali bir X ekseni olusturuyoruz - boylece "bu ay kimse
  // ayrilmadi ama biri basladi" gibi durumlar da dogru gorunur.
  const hireMonthKeys = [...new Set([...Object.keys(monthlyHires), ...Object.keys(monthlyDepartures), ...Object.keys(monthlyCancellations), ...Object.keys(monthlyPending)])].sort();

  // "Net kumulatif" cizginin SONU, bugunku gercek Aktif sayisiyla eslessin
  // diye - Ise Baslama Tarihi'ni HIC BILMEDIGIMIZ (HR senkronundan hic
  // gecmemis, eski/elle eklenmis) ama hala Aktif olan kisileri bir
  // "baslangic bakiyesi" olarak cizginin EN BASINA ekliyoruz. Aylik
  // cubuklar degismez (sadece TARIHI BILINEN hareketleri gosterir), ama
  // kumulatif cizgi artik gercek toplami yansitir.
  const baselineActiveCount = employees.filter((e) => e.AktifMi === 'Aktif' && isStsAkkuyu(e) && !e.IseBaslamaTarihi).length;

  const topCategory = Object.entries(spendByCategory).sort((a, b) => b[1] - a[1])[0];
  const topDept = Object.entries(spendByDept).sort((a, b) => b[1] - a[1])[0];
  const warrantySoonCount = items.filter((a) => {
    if (!a.GarantiBitisTarihi) return false;
    const d = new Date(a.GarantiBitisTarihi);
    const in30d = new Date(); in30d.setDate(in30d.getDate() + 30);
    return d >= now && d <= in30d;
  }).length;

  // ---- Ekipman bekleyen calisanlar - kendi ayagimiza sikmayacak sekilde:
  // 1) Planlanan Baslangic Tarihi bugunden 2 HAFTADAN FAZLA ileriyse, bu kisi
  //    HENUZ ekipman ihtiyaci olarak sayilmaz (Panel'deki "Yakinda Ise
  //    Baslayacaklar" ile AYNI 2 haftalik pencere mantigi).
  // 2) 0-14 gun arasi baslayacaklar AYRI bir "yakinda baslayacak" basligi
  //    altinda gosterilir - ana sayiya karistirilmaz.
  // 3) Ana sayidaki insanlar icin, Ihtiyac Listesi'nde ZATEN "Bekleniyor"
  //    (onay alinmis, siparis surecinde) kac CIHAZ oldugu da yaziliyor -
  //    "unutulmus" degil "surecte" oldugu netlessin diye.
  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
  function startDiffDays(e) {
    if (!e.PlanlananBaslangicTarihi) return null;
    const target = parseFlexDate(e.PlanlananBaslangicTarihi);
    if (!target) return null;
    return Math.round((target - todayMid) / 86400000);
  }
  const activeEmployeesForMissing = employees.filter((e) => (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && !e.ITMuaf && (!e.Firma || e.Firma === 'STS-Akkuyu'));
  const hasComputer = new Set(items.filter((a) => ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'].includes(a.Kategori) && a.AtananKisi).map((a) => a.AtananKisi));
  const missingComputerEmployeesAll = activeEmployeesForMissing.filter((e) => {
    if (hasComputer.has(e.AdSoyad)) return false;
    const muafList = e.MuafKategoriler ? e.MuafKategoriler.split(',') : [];
    return !muafList.includes('Bilgisayar');
  });
  const missingComputerNow = missingComputerEmployeesAll.filter((e) => { const d = startDiffDays(e); return d === null || d <= 0; });
  const missingComputerUpcoming = missingComputerEmployeesAll.filter((e) => { const d = startDiffDays(e); return d !== null && d > 0 && d <= 14; });
  const missingComputerCount = missingComputerNow.length;
  const upcomingMissingCount = missingComputerUpcoming.length;
  const pendingComputerNeeds = needs.filter((n) => n.Durum === 'Bekleniyor' && ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'].includes(n.Kategori));
  const pendingDeviceCount = pendingComputerNeeds.length;

  // ---- Anlati kartlari (otomatik olusturulan icgoru cumleleri) ----
  const insights = [
    `💰 ${t('mgmt_report_insight_total')}: ${fmtUSD(totalUSD)} · ₺${Math.round(totalTRY).toLocaleString('en-US')} · ₽${Math.round(totalRUB).toLocaleString('en-US')}`,
    topCategory ? `🏆 ${t('mgmt_report_insight_top_category')}: ${topCategory[0]} (${fmtUSD(topCategory[1])})` : null,
    topDept ? `🏢 ${t('mgmt_report_insight_top_dept')}: ${shortDeptLabel(topDept[0], lang)} (${fmtUSD(topDept[1])})` : null,
    last30dCount > 0 ? `📈 ${t('mgmt_report_insight_growth')}: ${last30dCount} ${t('mgmt_report_insight_growth_suffix')}` : null,
    `👤 ${t('mgmt_report_insight_active_count')}: ${currentActiveCount}`,
    otherCompanyActiveCount > 0 ? `🏗️ ${t('mgmt_report_insight_other_company')}: ${otherCompanyActiveCount}` : null,
    `📋 ${t('mgmt_report_insight_status_breakdown')}: ${t('employee_status_active')} ${statusCounts.Aktif} · ${t('employee_status_pending')} ${statusCounts.Beklemede} · ${t('employee_status_inactive_short')} ${statusCounts.Pasif} · ${t('employee_status_cancelled_short')} ${statusCounts.Iptal}`,
    dataGapsCount > 0 ? `🛠️ ${dataGapsCount} ${t('mgmt_report_insight_data_gaps')}` : null,
    last30dHires > 0 ? `👥 ${t('mgmt_report_insight_hires')}: ${last30dHires} ${t('mgmt_report_insight_hires_suffix')}` : null,
    last30dDepartures > 0 ? `🚪 ${t('mgmt_report_insight_departures')}: ${last30dDepartures} ${t('mgmt_report_insight_hires_suffix')}` : null,
    warrantySoonCount > 0 ? `⚠️ ${warrantySoonCount} ${t('mgmt_report_insight_warranty')}` : null,
    missingComputerCount > 0
      ? `👥 ${missingComputerCount} ${t('mgmt_report_insight_missing')}` + (pendingDeviceCount > 0 ? ` (${pendingDeviceCount} ${t('mgmt_report_computer_unit')} ${t('mgmt_report_insight_missing_inprocess')})` : '')
      : null,
    upcomingMissingCount > 0 ? `🗓️ ${upcomingMissingCount} ${t('mgmt_report_insight_upcoming')}` : null
  ].filter(Boolean);

  let insightRow = 5;
  insights.forEach((line) => {
    wsExec.mergeCells(`B${insightRow}:K${insightRow}`);
    const cell = wsExec.getCell(`B${insightRow}`);
    cell.value = line;
    cell.font = { size: 12, color: { argb: 'FF1F2A44' } };
    cell.alignment = { vertical: 'middle' };
    wsExec.getRow(insightRow).height = 22;
    insightRow++;
  });
  insightRow += 1;

  // ---- Grafikler: 2x2 duzen (departman harcamasi, aylik buyume, aylik ise
  // baslama, aylik harcama tutari). Buyume/ise baslama/harcama grafikleri
  // artik BAR (o ayin kendi degeri) + KIRMIZI CIZGI (kumulatif toplam)
  // kombinasyonu - departman harcamasi zaten bir anlik "kesit" oldugu icin
  // sade bar olarak kaliyor. ----
  const CHART_W = 460, CHART_H = 260;
  const ROW2_OFFSET = 13; // yaklasik satir yuksekligi hesabiyla ikinci sira grafiklerin baslangici

  const deptChartEntries = Object.entries(spendByDept).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const deptChartImg = renderBarChartPNG(deptChartEntries.map((x) => shortDeptLabel(x[0], lang)), deptChartEntries.map((x) => Math.round(x[1])), t('mgmt_report_chart_by_dept'), ACCENT, fmtUSD);
  wsExec.addImage(wb.addImage({ base64: deptChartImg, extension: 'png' }), { tl: { col: 1, row: insightRow }, ext: { width: CHART_W, height: CHART_H } });

  const growthMonthly = monthKeys.map((k) => monthlyGrowth[k]);
  const growthChartImg = renderComboChartPNG(monthKeys, growthMonthly, toCumulative(growthMonthly), t('mgmt_report_chart_growth'), '#16a34a', null, t('mgmt_report_legend_monthly'), t('mgmt_report_legend_cumulative'));
  wsExec.addImage(wb.addImage({ base64: growthChartImg, extension: 'png' }), { tl: { col: 9, row: insightRow }, ext: { width: CHART_W, height: CHART_H } });

  const hireMonthly = hireMonthKeys.map((k) => monthlyHires[k] || 0);
  const departureMonthly = hireMonthKeys.map((k) => monthlyDepartures[k] || 0);
  const cancelMonthly = hireMonthKeys.map((k) => monthlyCancellations[k] || 0);
  const pendingMonthly = hireMonthKeys.map((k) => monthlyPending[k] || 0);
  const hireChartImg = renderHiresDeparturesChartPNG(hireMonthKeys, hireMonthly, departureMonthly, pendingMonthly, cancelMonthly, baselineActiveCount, t('mgmt_report_chart_hires'), t('mgmt_report_legend_hires'), t('mgmt_report_legend_departures'), t('mgmt_report_legend_pending'), t('mgmt_report_legend_cancelled'), t('mgmt_report_legend_net'));
  wsExec.addImage(wb.addImage({ base64: hireChartImg, extension: 'png' }), { tl: { col: 1, row: insightRow + ROW2_OFFSET }, ext: { width: CHART_W, height: CHART_H } });

  const spendMonthly = monthKeys.map((k) => Math.round(monthlySpend[k]));
  const spendChartImg = renderComboChartPNG(monthKeys, spendMonthly, toCumulative(spendMonthly), t('mgmt_report_chart_monthly_spend'), '#7c3aed', fmtUSD, t('mgmt_report_legend_monthly'), t('mgmt_report_legend_cumulative'));
  wsExec.addImage(wb.addImage({ base64: spendChartImg, extension: 'png' }), { tl: { col: 9, row: insightRow + ROW2_OFFSET }, ext: { width: CHART_W, height: CHART_H } });

  // ============================================================
  // SAYFA 1 - ENVANTER
  // ============================================================
  const wsInv = wb.addWorksheet(t('nav_inventory'), { views: [{ state: 'frozen', ySplit: 0 }] });
  wsInv.getColumn(1).width = 3;

  wsInv.mergeCells('B2:J2');
  wsInv.getCell('B2').value = t('nav_inventory') + ' - ' + t('mgmt_report_title');
  wsInv.getCell('B2').font = TITLE_FONT;
  wsInv.mergeCells('B3:J3');
  wsInv.getCell('B3').value = t('mgmt_report_generated_on') + ': ' + todayStr;
  wsInv.getCell('B3').font = { size: 10, color: { argb: 'FF6B7280' } };

  // ---- Veri sutunlari (once hazirlanir ki KPI formulleri dogru araliga referans versin) ----
  // Fatura ve Teslim Formu linkleri: her link ayri sutun ("1.Fatura Link", "2.Fatura Link"...,
  // "1.Teslim Form"...). Virgulle ayrilmis tek hucre tiklanamadigi icin ayri hucrelere bolunur.
  const splitL = (v) => String(v || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  const formsByPerson = {};
  (employees || []).forEach((e) => { if (e.AdSoyad) formsByPerson[e.AdSoyad] = splitL(e.TeslimFormLink); });
  const invLinksOf = (a) => splitL(a.FaturaLink);
  const formLinksOf = (a) => (a.AtananKisi ? (formsByPerson[a.AtananKisi] || []) : []);
  const maxInv = Math.max(1, ...items.map((a) => invLinksOf(a).length));
  const maxForm = Math.max(1, ...items.map((a) => formLinksOf(a).length));
  const invLinkHeaders = Array.from({ length: maxInv }, (_, i) => `${i + 1}.${t('col_invoice_link')}`);
  const formLinkHeaders = Array.from({ length: maxForm }, (_, i) => `${i + 1}.${t('col_handover_form')}`);
  const colLetter = (n) => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
  const helperStart = 17 + maxInv + maxForm + 1 + 1; // 17 sabit + linkler + Notlar + 1 (1-tabanli)
  const [hInUse, hStock, hWarr] = [colLetter(helperStart), colLetter(helperStart + 1), colLetter(helperStart + 2)];
  const invHeaders = [
    t('col_id'), t('col_category'), t('col_brand'), t('col_model'), t('col_serial'),
    t('col_status'), t('col_location'), t('col_assigned'), t('col_assignment_date'),
    t('col_supplier'), t('form_purchase_date'), t('col_warranty'), t('col_price'), t('col_currency'),
    t('col_price_usd'), t('col_price_try'), t('col_price_rub'),
    ...invLinkHeaders, ...formLinkHeaders, t('col_notes'),
    '_IsKullanimda', '_IsStok', '_IsGarantiYaklasiyor'
  ];
  const DATA_HEADER_ROW = 20;
  const DATA_START = DATA_HEADER_ROW + 1;
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const today = new Date();

  const invRows = items.map((a) => {
    const garantiYaklasiyor = a.GarantiBitisTarihi
      ? (() => { const d = new Date(a.GarantiBitisTarihi); return d >= today && d <= in30 ? 1 : 0; })()
      : 0;
    return [
      a.ID, translateCategory(a.Kategori, lang), a.Marka, a.Model, a.SeriNo,
      translateStatus(a.Durum, lang), a.Lokasyon, a.AtananKisi, a.AtamaTarihi,
      a.Tedarikci, a.SatinAlmaTarihi, a.GarantiBitisTarihi, Number(a.Fiyat) || '', a.ParaBirimi,
      Number(a.FiyatUSD) || 0, Number(a.FiyatTRY) || 0, Number(a.FiyatRUB) || 0,
      ...Array.from({ length: maxInv }, (_, i) => { const u = invLinksOf(a)[i]; return u ? { text: `${i + 1}.${t('col_invoice_link')}`, hyperlink: u } : ''; }),
      ...Array.from({ length: maxForm }, (_, i) => { const u = formLinksOf(a)[i]; return u ? { text: `${i + 1}.${t('col_handover_form')}`, hyperlink: u } : ''; }),
      a.Notlar,
      a.Durum === 'Kullanimda' ? 1 : 0, a.Durum === 'Stok' ? 1 : 0, garantiYaklasiyor
    ];
  });
  const DATA_END = DATA_START + Math.max(0, invRows.length - 1);

  // ---- KPI kartlari (SUBTOTAL - Excel'de filtre degisince otomatik guncellenir) ----
  const kpiRow = 5;
  addKpiCard(wsInv, kpiRow, 2, t('report_total_assets'), `SUBTOTAL(103,A${DATA_START}:A${DATA_END})`, true);
  addKpiCard(wsInv, kpiRow, 4, t('report_in_use'), `SUBTOTAL(109,${hInUse}${DATA_START}:${hInUse}${DATA_END})`, true);
  addKpiCard(wsInv, kpiRow, 6, t('report_in_stock'), `SUBTOTAL(109,${hStock}${DATA_START}:${hStock}${DATA_END})`, true);
  addKpiCard(wsInv, kpiRow, 8, t('report_warranty_soon'), `SUBTOTAL(109,${hWarr}${DATA_START}:${hWarr}${DATA_END})`, true);

  const kpiRow2 = 8;
  addKpiCard(wsInv, kpiRow2, 2, t('report_budget_total') + ' (USD)', `SUBTOTAL(109,O${DATA_START}:O${DATA_END})`, true, '$#,##0');
  addKpiCard(wsInv, kpiRow2, 4, t('report_budget_total') + ' (TRY)', `SUBTOTAL(109,P${DATA_START}:P${DATA_END})`, true, '#,##0 ₺');
  addKpiCard(wsInv, kpiRow2, 6, t('report_budget_total') + ' (RUB)', `SUBTOTAL(109,Q${DATA_START}:Q${DATA_END})`, true, '#,##0 ₽');

  wsInv.getCell('B11').value = t('mgmt_report_filter_hint');
  wsInv.getCell('B11').font = { italic: true, size: 9, color: { argb: 'FF9CA3AF' } };
  wsInv.mergeCells('B11:J11');

  // ---- Grafik (statik goruntu) ----
  const kategoriDagilim = countBy(items, 'Kategori', (k) => translateCategory(k, lang));
  const chartImg = renderBarChartPNG(kategoriDagilim.map((x) => x[0]), kategoriDagilim.map((x) => x[1]), t('mgmt_report_chart_by_category'), ACCENT);
  const imgId = wb.addImage({ base64: chartImg, extension: 'png' });
  wsInv.addImage(imgId, { tl: { col: 1, row: 12 }, ext: { width: 680, height: 340 } });

  // ---- Veri tablosu ----
  const headerRow = wsInv.getRow(DATA_HEADER_ROW);
  invHeaders.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
  styleHeaderRow(headerRow);
  invRows.forEach((r, i) => {
    const row = wsInv.getRow(DATA_START + i);
    r.forEach((v, ci) => { row.getCell(ci + 1).value = v; });
  });
  wsInv.autoFilter = { from: { row: DATA_HEADER_ROW, column: 1 }, to: { row: DATA_END, column: invHeaders.length } };
  const invColWidths = [10, 18, 12, 16, 16, 12, 16, 18, 14, 14, 12, 12, 10, 8, 10, 10, 10, ...Array(maxInv + maxForm).fill(15), 20, 6, 6, 6];
  invColWidths.forEach((w, i) => { wsInv.getColumn(i + 1).width = w; });
  // Yardimci sutunlari (T/U/V) gizle - hesaplamada kullanilir ama gorunmesine gerek yok
  [hInUse, hStock, hWarr].forEach((c) => { wsInv.getColumn(c).hidden = true; });

  // ============================================================
  // SAYFA 2 - EKSIK EKIPMAN PANOSU
  // ============================================================
  const wsMissing = wb.addWorksheet(t('needs_missing_board_title'));
  wsMissing.getColumn(1).width = 3;
  wsMissing.mergeCells('B2:E2');
  wsMissing.getCell('B2').value = t('needs_missing_board_title');
  wsMissing.getCell('B2').font = TITLE_FONT;

  const activeEmployees = employees.filter((e) => (e.AktifMi === 'Aktif' || e.AktifMi === 'Beklemede') && !e.ITMuaf && (!e.Firma || e.Firma === 'STS-Akkuyu'));
  const MISSING_GROUPS = [
    { label: 'Bilgisayar', kategoriler: ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'] },
    { label: 'Monitor', kategoriler: ['Monitor'] }
  ];

  let curRow = 4;
  MISSING_GROUPS.forEach((group) => {
    const hasIt = new Set(items.filter((a) => group.kategoriler.includes(a.Kategori) && a.AtananKisi).map((a) => a.AtananKisi));
    const missing = activeEmployees.filter((e) => {
      if (hasIt.has(e.AdSoyad)) return false;
      const muafList = e.MuafKategoriler ? e.MuafKategoriler.split(',') : [];
      return !muafList.includes(group.label);
    });

    wsMissing.mergeCells(`B${curRow}:E${curRow}`);
    const sectionCell = wsMissing.getCell(`B${curRow}`);
    sectionCell.value = `${translateCategory(group.label, lang)} ${t('report_missing_it')} (${missing.length})`;
    sectionCell.font = { bold: true, size: 12, color: { argb: 'FFB91C1C' } };
    curRow++;

    const hRow = wsMissing.getRow(curRow);
    hRow.getCell(2).value = t('needs_col_person');
    hRow.getCell(3).value = t('col_department');
    hRow.getCell(4).value = t('col_title');
    styleHeaderRow(hRow);
    curRow++;

    if (missing.length === 0) {
      wsMissing.getCell(`B${curRow}`).value = t('needs_missing_none');
      wsMissing.getCell(`B${curRow}`).font = { italic: true, color: { argb: 'FF6B7280' } };
      curRow += 2;
    } else {
      missing.forEach((e) => {
        wsMissing.getCell(`B${curRow}`).value = e.AdSoyad;
        wsMissing.getCell(`C${curRow}`).value = e.Departman;
        wsMissing.getCell(`D${curRow}`).value = e.Unvan;
        curRow++;
      });
      curRow += 1;
    }
  });
  wsMissing.getColumn(2).width = 26;
  wsMissing.getColumn(3).width = 38;
  wsMissing.getColumn(4).width = 24;

  // ============================================================
  // SAYFA 3 - IHTIYAC LISTESI
  // ============================================================
  const wsNeeds = wb.addWorksheet(t('nav_needs'));
  wsNeeds.getColumn(1).width = 3;
  wsNeeds.mergeCells('B2:K2');
  wsNeeds.getCell('B2').value = t('nav_needs') + ' - ' + t('mgmt_report_title');
  wsNeeds.getCell('B2').font = TITLE_FONT;
  wsNeeds.mergeCells('B3:K3');
  wsNeeds.getCell('B3').value = t('mgmt_report_generated_on') + ': ' + todayStr;
  wsNeeds.getCell('B3').font = { size: 10, color: { argb: 'FF6B7280' } };

  const needsHeaders = [
    t('col_id'), t('needs_col_person'), t('col_department'), t('col_category'), t('sarf_col_name'),
    t('col_price'), t('col_currency'), t('col_price_try'), t('col_status'), t('needs_col_planned_date'), t('needs_col_order_date'),
    '_ButceTRY', '_IsBekleyen', '_IsSiparisVerildi'
  ];
  const NEEDS_HEADER_ROW = 24;
  const NEEDS_START = NEEDS_HEADER_ROW + 1;
  // "Karsilandi" (zaten satin alinmis) kayitlar bu sayfaya DAHIL EDILMEZ -
  // onlar zaten Envanter sayfasinda goruntulenebiliyor, burada tekrar
  // gostermek kafa karistirici. Bu sayfa SADECE hala butce/surec bekleyen
  // (Bekleyen + Siparis Verildi) kayitlari gosterir.
  const activeNeeds = needs.filter((n) => n.Durum !== 'Karsilandi');
  const needsRows = activeNeeds.map((n) => {
    // FiyatTRY yeni kayitlarda otomatik hesaplaniyor, ama bu ozellikten ONCE
    // olusturulmus eski kayitlarda bos olabilir - o durumda GUNCEL kurla
    // (Ihtiyaclar.jsx'teki Toplam Butce karti ile AYNI yedek mantikla) hesapliyoruz.
    let fiyatTRY = Number(n.FiyatTRY) || 0;
    if (!fiyatTRY && n.Fiyat) {
      const cur = n.ParaBirimi || 'TRY';
      if (cur === 'TRY') fiyatTRY = Number(n.Fiyat);
      else if (rates && rates[cur]) fiyatTRY = Number(n.Fiyat) * rates[cur];
    }
    return [
      n.ID, n.PersonelAdi, n.Departman, translateCategory(n.Kategori, lang), n.MalzemeAdi || n.Aciklama,
      Number(n.Fiyat) || '', n.ParaBirimi, fiyatTRY, translateStatus(n.Durum, lang), n.PlanlananTarih, n.SiparisTarihi,
      n.Durum === 'Iptal' ? 0 : fiyatTRY,
      n.Durum === 'Bekleniyor' ? 1 : 0, n.Durum === 'Siparis Verildi' ? 1 : 0
    ];
  });
  const NEEDS_END = NEEDS_START + Math.max(0, needsRows.length - 1);

  // ---- Toplam Butce (kullanicinin istedigi TAM tablo) ----
  wsNeeds.getCell('B5').value = t('needs_budget_total');
  wsNeeds.getCell('B5').font = { bold: true, size: 12, color: { argb: 'FF1F2A44' } };
  wsNeeds.getCell('B6').value = t('needs_budget_note');
  wsNeeds.mergeCells('B6:K6');
  wsNeeds.getCell('B6').font = { italic: true, size: 9, color: { argb: 'FF9CA3AF' } };

  const budgetHeaderRow = wsNeeds.getRow(8);
  ['', 'USD', 'TRY', 'RUB'].forEach((h, i) => { budgetHeaderRow.getCell(2 + i).value = h; });
  styleHeaderRow(budgetHeaderRow);
  wsNeeds.getRow(8).getCell(1).value = null;

  // Kur referans hucreleri (TRY -> USD/RUB donusumu icin)
  wsNeeds.getCell('N8').value = t('mgmt_report_usd_rate');
  wsNeeds.getCell('N8').font = { size: 8, color: { argb: 'FF9CA3AF' } };
  wsNeeds.getCell('O8').value = Number(rates?.USD) || 1;
  wsNeeds.getCell('N9').value = t('mgmt_report_rub_rate');
  wsNeeds.getCell('N9').font = { size: 8, color: { argb: 'FF9CA3AF' } };
  wsNeeds.getCell('O9').value = Number(rates?.RUB) || 1;

  const tryHaricFormula = `SUBTOTAL(109,L${NEEDS_START}:L${NEEDS_END})`;
  wsNeeds.getCell('B9').value = t('kdv_haric_label');
  wsNeeds.getCell('C9').value = { formula: `D9/O8` };
  wsNeeds.getCell('D9').value = { formula: tryHaricFormula };
  wsNeeds.getCell('E9').value = { formula: `D9/O9` };
  wsNeeds.getCell('B10').value = t('kdv_dahil_label') + ' (%20)';
  wsNeeds.getCell('C10').value = { formula: 'C9*1.2' };
  wsNeeds.getCell('D10').value = { formula: 'D9*1.2' };
  wsNeeds.getCell('E10').value = { formula: 'E9*1.2' };
  ['C9', 'C10'].forEach((c) => { wsNeeds.getCell(c).numFmt = '$#,##0'; });
  ['D9', 'D10'].forEach((c) => { wsNeeds.getCell(c).numFmt = '#,##0 ₺'; });
  ['E9', 'E10'].forEach((c) => { wsNeeds.getCell(c).numFmt = '#,##0 ₽'; });
  wsNeeds.getCell('B10').font = { bold: true };
  ['C10', 'D10', 'E10'].forEach((c) => { wsNeeds.getCell(c).font = { bold: true }; });

  // ---- Durum KPI kartlari (Karsilandi haric - o zaten Envanter'de) ----
  addKpiCard(wsNeeds, 13, 2, t('needs_pending'), `SUBTOTAL(109,M${NEEDS_START}:M${NEEDS_END})`, true);
  addKpiCard(wsNeeds, 13, 4, t('needs_ordered'), `SUBTOTAL(109,N${NEEDS_START}:N${NEEDS_END})`, true);

  wsNeeds.getCell('B16').value = t('mgmt_report_filter_hint');
  wsNeeds.getCell('B16').font = { italic: true, size: 9, color: { argb: 'FF9CA3AF' } };
  wsNeeds.mergeCells('B16:K16');

  const durumDagilim = countBy(activeNeeds, 'Durum', (d) => translateStatus(d, lang));
  const chartImg2 = renderBarChartPNG(durumDagilim.map((x) => x[0]), durumDagilim.map((x) => x[1]), t('mgmt_report_chart_by_status'), '#e0a03a');
  const imgId2 = wb.addImage({ base64: chartImg2, extension: 'png' });
  wsNeeds.addImage(imgId2, { tl: { col: 1, row: 16 }, ext: { width: 680, height: 340 } });

  const needsHeaderRow = wsNeeds.getRow(NEEDS_HEADER_ROW);
  needsHeaders.forEach((h, i) => { needsHeaderRow.getCell(i + 1).value = h; });
  styleHeaderRow(needsHeaderRow);
  needsRows.forEach((r, i) => {
    const row = wsNeeds.getRow(NEEDS_START + i);
    r.forEach((v, ci) => { row.getCell(ci + 1).value = v; });
  });
  wsNeeds.autoFilter = { from: { row: NEEDS_HEADER_ROW, column: 1 }, to: { row: NEEDS_END, column: needsHeaders.length } };
  const needsColWidths = [10, 20, 22, 16, 22, 10, 8, 10, 14, 14, 14, 10, 8, 8];
  needsColWidths.forEach((w, i) => { wsNeeds.getColumn(i + 1).width = w; });
  ['L', 'M', 'N'].forEach((c) => { wsNeeds.getColumn(c).hidden = true; });

  // ============================================================
  // SAYFA 4 - KUR BILGILERI
  // ============================================================
  // Her varlik/ihtiyac kaydinin fiyati, KENDI tarihindeki (Satin Alma Tarihi
  // icin Envanter; Planlanan/Siparis Tarihi icin Ihtiyac Listesi) gercek TCMB
  // kuruyla backend'de onceden cevrilmis geliyor (FiyatTRY alanlari). Bu sayfa,
  // o hazir degerlerden GERIYE DOGRU ("FiyatTRY / Fiyat") efektif kuru
  // hesaplayip, hangi tarihte hangi kurun kullanildigini SEFFAF sekilde
  // gosterir - yeni bir hesaplama yapmaz, sadece zaten kullanilani acikca listeler.
  const wsRates = wb.addWorksheet(t('mgmt_report_rates_title'));
  wsRates.getColumn(1).width = 3;
  wsRates.mergeCells('B2:F2');
  wsRates.getCell('B2').value = t('mgmt_report_rates_title');
  wsRates.getCell('B2').font = TITLE_FONT;
  wsRates.mergeCells('B3:F4');
  wsRates.getCell('B3').value = t('mgmt_report_rates_desc');
  wsRates.getCell('B3').font = { italic: true, size: 9, color: { argb: 'FF9CA3AF' } };
  wsRates.getRow(3).height = 30;
  wsRates.getCell('B3').alignment = { wrapText: true, vertical: 'top' };

  const rateByDate = {}; // { [tarih]: { USD:[..], EUR:[..], RUB:[..], sources:Set } }
  function addRateSample(dateStr, currency, fiyat, fiyatTRY, source) {
    if (!dateStr || !currency || currency === 'TRY' || !fiyat || !fiyatTRY) return;
    if (!rateByDate[dateStr]) rateByDate[dateStr] = { USD: [], EUR: [], RUB: [], sources: new Set() };
    if (!rateByDate[dateStr][currency]) return; // beklenmeyen para birimi, atla
    rateByDate[dateStr][currency].push(fiyatTRY / fiyat);
    rateByDate[dateStr].sources.add(source);
  }
  items.forEach((a) => {
    addRateSample(a.SatinAlmaTarihi || a.OlusturmaTarihi, a.ParaBirimi, Number(a.Fiyat), Number(a.FiyatTRY), t('nav_inventory'));
  });
  needs.forEach((n) => {
    const dateStr = n.Durum === 'Bekleniyor' ? (n.PlanlananTarih || n.OlusturmaTarihi) : (n.SiparisTarihi || n.PlanlananTarih || n.OlusturmaTarihi);
    let fiyatTRY = Number(n.FiyatTRY) || 0;
    const cur = n.ParaBirimi || 'TRY';
    if (!fiyatTRY && n.Fiyat && cur !== 'TRY' && rates && rates[cur]) fiyatTRY = Number(n.Fiyat) * rates[cur];
    addRateSample(dateStr, cur, Number(n.Fiyat), fiyatTRY, t('nav_needs'));
  });

  const avg = (arr) => (arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10000) / 10000 : '');
  const rateRows = Object.keys(rateByDate).sort().map((dateStr) => {
    const r = rateByDate[dateStr];
    return [dateStr, avg(r.USD), avg(r.EUR), avg(r.RUB), Array.from(r.sources).join(', ')];
  });

  const RATE_HEADER_ROW = 6;
  const rateHeaders = [t('mgmt_report_rate_date'), 'USD/TRY', 'EUR/TRY', 'RUB/TRY', t('mgmt_report_rate_source')];
  const rateHeaderRowObj = wsRates.getRow(RATE_HEADER_ROW);
  rateHeaders.forEach((h, i) => { rateHeaderRowObj.getCell(2 + i).value = h; });
  styleHeaderRow(rateHeaderRowObj);
  rateRows.forEach((r, i) => {
    const row = wsRates.getRow(RATE_HEADER_ROW + 1 + i);
    r.forEach((v, ci) => { row.getCell(2 + ci).value = v; });
  });
  [10, 12, 12, 12, 24].forEach((w, i) => { wsRates.getColumn(2 + i).width = w; });

  // ---- Kaydet ----
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `Yonetim_Raporu_${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
