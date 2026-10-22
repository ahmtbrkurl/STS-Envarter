// Yazici Adres Defteri export - Xerox C235 (.ucf) ve Kyocera ECOSYS
// M8124cidn (.xml) formatlari. Mantik, kullanicinin daha once ayri bir
// arac olarak kullandigi "Yazici Adres Defteri Araci"ndan BIREBIR
// portlandi - sadece veri kaynagi artik Excel yuklemek yerine
// uygulamadaki calisanlar listesi.

function xeroxEncode(str) {
  return encodeURIComponent(str).replace(/%20/g, '+');
}

function buildXerox(rows) {
  const lines = [];
  lines.push('// Xerox C235 Email Shortcuts');
  lines.push('// UTF-8. Generated automatically from STS-Envanter.');
  rows.forEach((r, idx) => {
    const short = idx + 1;
    const nameEnc = xeroxEncode(r.name);
    const addr = r.emails.length === 1 ? xeroxEncode(r.emails[0]) : r.emails.join(',');
    const line = 'DESTEMAILADD "STYPE=Email;DISPLAY=0;ICON=;SHORT=' + short + ';LABEL=;ADDR=' + addr +
      ';ANNOTATIONS=226;ARCHIVALPDF=0;ARCHIVALPDFVERSION=1;AUTOCONTENHOCR=0;AUTOROTOCR=0;BGDETECT=0;BGREMOVE=0;BCC=;BITDEPTH=1;BLANKPAGEREMOVAL=0;CC=;IMAGES_PER_SPLIT=0;CBBLUE=0;CBGREEN=0;CBRED=0;COLORDROPOUT=0;COLORDROPOUTBLUE=128;COLORDROPOUTGREEN=128;COLORDROPOUTRED=128;COLORTEMPERATURE=0;CONTENTTYPE=1;DOCSOURCE=1;CONTRAST=-1;DARKNESS=5;DESKEW=1;DESPOCROCR=0;EEBOTTOM=0;EELEFT=0;EERIGHT=0;EETOP=0;EDGETOEDGE=0;FILENAME=' + nameEnc +
      ';FILETYPE=2;JOBBUILD=0;JPEGQUALITY=-1;MESSAGE=;MIRROR=0;ADFMFSENSOR=1;NAME=' + nameEnc +
      ';NEGIMG=0;OCRLANG=1;ORIENT=0;ORIGINALSIZE=4;PDFCOMP=-1;PDFVER=3;PRINTLOGS=0;RES=150;RUNIMMEDIATELY=1;COLOR=1;DUPLEX=0;SCANPREVIEW=0;SEARCHPDF=0;SECUREPDF=0;SHADING=0;SHARPNESS=3;SUBJECT=;TIFFCOMP=1;"';
    lines.push(line);
  });
  lines.push('');
  return lines.join('\n');
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildKyocera(rows) {
  const items = [];
  let id = 1;
  rows.forEach((r) => {
    if (r.emails.length === 1) {
      items.push({ id: id++, name: r.name, email: r.emails[0] });
    } else {
      const domains = r.emails.map((e) => (e.split('@')[1] || '').toLowerCase());
      const uniqueDomains = {};
      domains.forEach((d) => { uniqueDomains[d] = true; });
      const useTld = Object.keys(uniqueDomains).length === domains.length;
      r.emails.forEach((email, i) => {
        let suffix;
        if (useTld) {
          const domain = email.split('@')[1] || '';
          const parts = domain.split('.');
          suffix = parts[parts.length - 1].toUpperCase();
        } else {
          suffix = String(i + 1);
        }
        items.push({ id: id++, name: r.name + ' - ' + suffix, email });
      });
    }
  });

  const lines = [];
  lines.push('<?xml version="1.0"?>');
  lines.push('<DeviceAddressBook_v5_2>');
  items.forEach((it) => {
    const nameEsc = escapeXml(it.name);
    const emailEsc = escapeXml(it.email);
    lines.push('  <Item Type="Contact" Id="' + it.id + '" DisplayName="' + nameEsc + '" SendKeisyou="0" DisplayNameKana="' + nameEsc + '" MailAddress="' + emailEsc + '" SendCorpName="" SendPostName="" SendAddrName="" SmbHostName="" SmbPath="" SmbLoginName="" SmbLoginPasswd="" SmbPort="445" FtpPath="" FtpHostName="" FtpLoginName="" FtpLoginPasswd="" FtpPort="21" FaxNumber="" FaxSubaddress="" FaxPassword="" FaxCommSpeed="BPS_9600" FaxECM="Off" FaxEncryptKeyNumber="0" FaxEncryption="Off" FaxEncryptBoxEnabled="Off" FaxEncryptBoxID="0000" InetFAXAddr="" InetFAXMode="Simple" InetFAXResolution="3" InetFAXFileType="TIFF_MH" IFaxSendModeType="IFAX" InetFAXDataSize="1" InetFAXPaperSize="1" InetFAXResolutionEnum="Default" InetFAXPaperSizeEnum="Default" />');
  });
  lines.push('</DeviceAddressBook_v5_2>');
  const body = lines.join('\r\n');
  const checksum = sha1Hex(body);
  return body + '\r\n<!--' + checksum + '-->';
}

// Minimal SHA-1 (Kyocera'nin kendi adres defteri export'unun ekledigi
// checksum ile ayni formatta - Multi-Set / Command Center RX dosyayi
// "degistirilmemis" olarak taniyor). Kamu malı referans uygulama.
function sha1Hex(str) {
  function rotateLeft(n, s) { return (n << s) | (n >>> (32 - s)); }
  function toHex(n) {
    let s = '', v;
    for (let i = 7; i >= 0; i--) { v = (n >>> (i * 4)) & 0x0f; s += v.toString(16); }
    return s;
  }
  function utf8Encode(s) { return unescape(encodeURIComponent(s)); }

  const msg = utf8Encode(str);
  const msgLen = msg.length;
  const wordArray = [];
  for (let i = 0; i < msgLen - 3; i += 4) {
    wordArray.push(msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 | msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3));
  }
  switch (msgLen % 4) {
    case 0: wordArray.push(0x080000000); break;
    case 1: wordArray.push(msg.charCodeAt(msgLen - 1) << 24 | 0x0800000); break;
    case 2: wordArray.push(msg.charCodeAt(msgLen - 2) << 24 | msg.charCodeAt(msgLen - 1) << 16 | 0x08000); break;
    case 3: wordArray.push(msg.charCodeAt(msgLen - 3) << 24 | msg.charCodeAt(msgLen - 2) << 16 | msg.charCodeAt(msgLen - 1) << 8 | 0x80); break;
    default: break;
  }
  while ((wordArray.length % 16) !== 14) wordArray.push(0);
  wordArray.push(msgLen >>> 29);
  wordArray.push((msgLen << 3) & 0x0ffffffff);

  let H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0;
  const W = new Array(80);
  for (let blockstart = 0; blockstart < wordArray.length; blockstart += 16) {
    for (let i = 0; i < 16; i++) W[i] = wordArray[blockstart + i];
    for (let i = 16; i < 80; i++) W[i] = rotateLeft(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
    let A = H0, B = H1, C = H2, D = H3, E = H4;
    for (let i = 0; i < 80; i++) {
      let temp;
      if (i < 20) temp = (rotateLeft(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
      else if (i < 40) temp = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
      else if (i < 60) temp = (rotateLeft(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
      else temp = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
      E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
    }
    H0 = (H0 + A) & 0x0ffffffff; H1 = (H1 + B) & 0x0ffffffff; H2 = (H2 + C) & 0x0ffffffff; H3 = (H3 + D) & 0x0ffffffff; H4 = (H4 + E) & 0x0ffffffff;
  }
  return (toHex(H0) + toHex(H1) + toHex(H2) + toHex(H3) + toHex(H4)).toUpperCase();
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// employees: uygulamadaki tam calisan listesi. Sadece Aktif + STS-Akkuyu
// (Outlook export'uyla ayni kural) ve gecerli e-postasi olanlar alinir.
// Iki dosya da AYRI AYRI, tek cagriyla indirilir.
export function exportPrinterAddressBooks(employees) {
  const rows = employees
    .filter((e) => e.AktifMi === 'Aktif' && (!e.Firma || e.Firma === 'STS-Akkuyu'))
    .map((e) => {
      const emails = e.Email
        ? e.Email.split(/[,;\n]+/).map((s) => s.trim()).filter((s) => s && /\S+@\S+\.\S+/.test(s))
        : [];
      const seen = new Set();
      const uniqueEmails = emails.filter((em) => {
        const k = em.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { name: e.AdSoyad, emails: uniqueEmails };
    })
    .filter((r) => r.name && r.emails.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }));

  downloadFile('XeroxC235_AdresDefteri.ucf', buildXerox(rows), 'text/plain;charset=utf-8');
  downloadFile('ECOSYS_M8124cidn_AdresDefteri.xml', buildKyocera(rows), 'application/xml;charset=utf-8');

  return { count: rows.length, totalEmails: rows.reduce((s, r) => s + r.emails.length, 0) };
}
