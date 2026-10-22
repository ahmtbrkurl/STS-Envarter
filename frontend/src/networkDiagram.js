// Envanter (kim nerede, ne kullaniyor) ve Ag Altyapisi (VLAN/Port) verisinden
// OTOMATIK, guncel tarihli bir "Ag ve Ekipman Haritasi" HTML sayfasi uretir.
// Kullanici bunu tarayicida acip Ctrl+P ile PDF'e cevirebilir - Visio'daki
// gibi piksel piksel ayni degil, ama HER ZAMAN GUNCEL ve tek tikla.

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function groupByLocation(items) {
  const groups = {};
  items
    .filter((a) => a.Durum === 'Kullanimda' || a.Durum === 'Depoda')
    .forEach((a) => {
      const site = a.Lokasyon || '—';
      const detay = a.LokasyonDetay || '';
      const key = site + '||' + detay;
      if (!groups[key]) groups[key] = { site, detay, items: [] };
      groups[key].items.push(a);
    });
  return Object.values(groups).sort((a, b) => (a.site + a.detay).localeCompare(b.site + b.detay, 'tr'));
}

function deviceIcon(kategori) {
  const k = (kategori || '').toLowerCase();
  if (k.includes('yazici') || k.includes('printer')) return '🖨️';
  if (k.includes('monitor')) return '🖥️';
  if (k.includes('dizustu') || k.includes('laptop')) return '💻';
  if (k.includes('masaustu') || k.includes('desktop')) return '🖳';
  if (k.includes('telefon') || k.includes('phone')) return '📱';
  if (k.includes('tablet')) return '📱';
  return '🔧';
}

export function buildNetworkDiagramHtml({ items, vlanRows, portRows, title, t, lang }) {
  const groups = groupByLocation(items);
  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-GB' : 'tr-TR');

  const containerCards = groups.map((g) => `
    <div class="container-card">
      <div class="container-head">${esc(g.site)}${g.detay ? ' — ' + esc(g.detay) : ''}</div>
      ${g.items.map((a) => `
        <div class="device-row">
          <span class="device-icon">${deviceIcon(a.Kategori)}</span>
          <div class="device-info">
            <div class="device-title">${esc(a.ID)} · ${esc(a.Marka)} ${esc(a.Model)}</div>
            <div class="device-sub">${esc(a.AtananKisi || '—')}${a.MAC ? ' · ' + esc(a.MAC) : ''}${a.Hostname ? ' · ' + esc(a.Hostname) : ''}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  const vlanTableRows = (vlanRows || []).map((v) => `
    <tr>
      <td>${esc(v.VlanID)}</td><td>${esc(v.Ad)}</td><td>${esc(v.Network)}</td>
      <td>${esc(v.Gateway)}</td><td>${esc(v.DhcpAralik)}</td><td>${esc(v.DhcpVarMi)}</td>
    </tr>
  `).join('');

  const portTableRows = (portRows || []).map((p) => `
    <tr>
      <td>${esc(p.Port)}</td><td>${esc(p.Tip)}</td><td>${esc(p.Vlan)}</td><td>${esc(p.BagliCihaz)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 28px; background: #fff; color: #1a1a2e; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  h2 { font-size: 16px; margin: 28px 0 12px; border-bottom: 2px solid #2563eb; padding-bottom: 6px; }
  .container-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .container-card { border: 1px solid #d0d0d8; border-radius: 8px; overflow: hidden; break-inside: avoid; }
  .container-head { background: #2563eb; color: #fff; font-weight: 600; font-size: 13px; padding: 8px 12px; }
  .device-row { display: flex; gap: 8px; align-items: flex-start; padding: 7px 12px; border-top: 1px solid #eee; font-size: 12px; }
  .device-icon { font-size: 14px; }
  .device-title { font-weight: 600; }
  .device-sub { color: #6b7280; font-size: 11px; margin-top: 1px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #d0d0d8; padding: 6px 10px; text-align: left; }
  th { background: #f3f4f6; }
  @media print { body { padding: 10px; } .container-card { page-break-inside: avoid; } }
</style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <div class="subtitle">Guncelleme tarihi: ${dateStr} · STS-Envanter'den otomatik uretildi</div>

  <h2>Lokasyon / Konteyner Bazinda Ekipman</h2>
  <div class="container-grid">
    ${containerCards || '<p>Kayitli ekipman yok.</p>'}
  </div>

  ${(vlanRows && vlanRows.length > 0) ? `
  <h2>VLAN Tablosu</h2>
  <table>
    <thead><tr><th>VLAN ID</th><th>Ad</th><th>Network</th><th>Gateway</th><th>DHCP Araligi</th><th>DHCP?</th></tr></thead>
    <tbody>${vlanTableRows}</tbody>
  </table>` : ''}

  ${(portRows && portRows.length > 0) ? `
  <h2>Port Haritasi</h2>
  <table>
    <thead><tr><th>Port</th><th>Tip</th><th>VLAN</th><th>Bagli Cihaz</th></tr></thead>
    <tbody>${portTableRows}</tbody>
  </table>` : ''}
</body>
</html>`;
}

export function downloadNetworkDiagram(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
