// Kisisel telefon MAC adresleri (personel Wi-Fi tanitimi icin). Birden fazla
// cihaz virgulle ayrilir. Her adres AA:BB:CC:DD:EE:FF bicimine cevrilir.
// Rusca klavyeyle yazilmis/yapistirilmis, Latin harflere birebir benzeyen Kiril
// harfleri (А В С Е ... gorunuste A B C E ile ayni) duzeltilir.
const CYRILLIC_LOOKALIKES = { 'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'а': 'a', 'с': 'c', 'е': 'e', 'О': '0', 'о': '0' };
function fixLookalikes(str) {
  return String(str || '').replace(/[АВСЕасеОо]/g, (ch) => CYRILLIC_LOOKALIKES[ch]);
}

export function parseMacs(input) {
  const parts = fixLookalikes(input).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const valid = [];
  const invalid = [];
  parts.forEach((p) => {
    const hex = p.replace(/[^0-9a-fA-F]/g, '');
    const onlyMacChars = /^[0-9a-fA-F:.\-\s]+$/.test(p);
    if (onlyMacChars && hex.length === 12) {
      const mac = hex.toUpperCase().match(/.{2}/g).join(':');
      if (valid.indexOf(mac) === -1) valid.push(mac);
    } else invalid.push(p);
  });
  return { valid, invalid };
}

// Kaydetmeden once: gecersiz varsa Error firlatir, yoksa normalize string doner.
export function normalizeMacsOrThrow(input, errorText) {
  const { valid, invalid } = parseMacs(input);
  if (invalid.length) throw new Error(`${errorText}: ${invalid.join(', ')}`);
  return valid.join(', ');
}
