import Papa from 'papaparse';
import { parseMacs } from './macUtils.js';
import { excelSafeText } from './exportUtils.js';

const PC_CATEGORIES = ['Dizustu Bilgisayar', 'Masaustu Bilgisayar'];

// Lokasyona gore "personel + uzerine kayitli cihazlarin MAC listesi" satirlarini uretir.
// Personelin lokasyonu, uzerine kayitli varliklarin Lokasyon alanindan bulunur
// (calisan kaydinda ayri bir lokasyon alani yok).
export function buildMacExportRows({ items, employees, location, onlyComputers, labels }) {
  const byPerson = new Map();
  items.forEach((a) => {
    if (!a.AtananKisi || a.Lokasyon !== location) return;
    if (onlyComputers && !PC_CATEGORIES.includes(a.Kategori)) return;
    if (!byPerson.has(a.AtananKisi)) byPerson.set(a.AtananKisi, []);
    byPerson.get(a.AtananKisi).push(a);
  });
  const empByName = new Map(employees.map((e) => [e.AdSoyad, e]));
  const people = [...byPerson.keys()].sort((x, y) => x.localeCompare(y, 'tr'));

  const lines = [];
  let maxMacs = 2;
  people.forEach((name) => {
    const emp = empByName.get(name);
    const phoneMacs = parseMacs(emp?.TelefonMAC || '').valid;
    const devices = [{ type: labels.phone, id: '', macs: phoneMacs }];
    byPerson.get(name).forEach((a) => {
      devices.push({ type: [a.Kategori, a.Marka, a.Model].filter(Boolean).join(' '), id: a.ID, macs: parseMacs(a.MAC || '').valid });
    });
    devices.forEach((d) => { maxMacs = Math.max(maxMacs, d.macs.length); });
    lines.push({ name, emp, devices });
  });

  const fields = [labels.person, labels.deviceCount, labels.no, labels.deviceType, labels.deviceId];
  for (let i = 1; i <= maxMacs; i++) fields.push('MAC ' + i);
  const data = [];
  lines.forEach(({ name, emp, devices }) => {
    const label = emp?.PersonelID ? `${name} (${emp.PersonelID})` : name;
    devices.forEach((d, idx) => {
      const row = [idx === 0 ? label : '', idx === 0 ? `${devices.length} ${labels.deviceWord}` : '', idx + 1, d.type, d.id];
      for (let i = 0; i < maxMacs; i++) row.push(d.macs[i] ? excelSafeText(d.macs[i]) : '');
      data.push(row);
    });
  });
  return { csv: Papa.unparse({ fields, data }), personCount: lines.length };
}
