// TEK SEFERLIK KURULUM SCRIPTI: Servis hesabinin Drive'da depolama kotasi
// olmadigi icin ("Service Accounts do not have storage quota" hatasi),
// dosya yukleme/yedekleme islemlerini SIZIN KENDI Google hesabiniz adina
// yapmamiz gerekiyor - tipki Apps Script'in sizin hesabinizla calismasi gibi.
//
// Bu script SADECE BIR KERE calistirilir: tarayicida Google hesabinizla
// giris yapip izin verirsiniz, script bir "refresh token" kaydeder, ondan
// sonra drive.js hep bu token'i kullanir - tekrar giris yapmaniza gerek kalmaz.
require('dotenv').config();
const http = require('http');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const TOKEN_PATH = path.join(__dirname, 'oauth-token.json');
const PORT = 8788;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\nHATA: .env dosyasinda OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET tanimli degil.');
  console.error('Once README.md > "Drive icin OAuth kurulumu" bolumundeki adimlari tamamlayin.\n');
  process.exit(1);
}

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline', // refresh token almak icin sart
  prompt: 'consent',      // her zaman refresh token dondurmesi icin sart
  scope: ['https://www.googleapis.com/auth/drive']
});

console.log('\n1) Asagidaki adresi bir tarayicida acin (kendi Google hesabinizla giris yapin):\n');
console.log(authUrl);
console.log('\n2) Izin verdikten sonra bu pencere otomatik devam edecek...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) return;
  const qs = new URL(req.url, REDIRECT_URI).searchParams;
  const code = qs.get('code');
  if (!code) {
    res.end('Kod bulunamadi, terminale donup tekrar deneyin.');
    return;
  }
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.end('Basarili! Bu sekmeyi kapatabilirsiniz, terminale donun.');
    console.log('Token kaydedildi: ' + TOKEN_PATH);
    console.log('Artik "npm start" ile sunucuyu normal calistirabilirsiniz.\n');
  } catch (e) {
    res.end('Hata: ' + e.message);
    console.error(e);
  } finally {
    server.close();
  }
});

server.listen(PORT);
