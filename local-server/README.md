# STS Envanter - Yerel Sunucu (Hibrit Kurulum)

Bu klasor, Apps Script Web App'in yerine gecen bir yerel Node.js sunucusudur.
Veri hala Google Sheets'te durur (bulut yedekleme/goruntuleme aynen devam
eder), ama istekler Apps Script calisma-zamanindan degil, DOGRUDAN Google
Sheets/Drive API'sinden gecer - Apps Script'in tipik gecikmesi ortadan kalkar.

**ONEMLI:** Bu klasoru Google Drive ile senkronize olan bir yerde (orn. bir
"G:\" surucusu) DEGIL, bilgisayarinizdaki sirf yerel bir klasorde
calistirin (orn. Masaustu). `npm install` binlerce kucuk dosya
olusturuyor, Drive'in senkronizasyon katmani bunlarla capismalar
yasayabilir.

## Kurulum (bir kere yapilir)

1. Google Cloud servis hesabi olusturun, `.json` anahtar dosyasini indirin,
   bu klasore `service-account.json` adiyla kopyalayin.
2. Google Cloud Console > API'ler ve Hizmetler > Kitaplik'te HEM
   **Google Sheets API** HEM **Google Drive API**'yi etkinlestirin
   (dosya yukleme/yedekleme Drive API'ye ihtiyac duyar - unutulursa
   "has not been used in project..." hatasi alirsiniz).
3. `.env.example`'i `.env` olarak kopyalayin, `APP_TOKEN` degerini Apps
   Script > Project Settings > Script Properties > APP_TOKEN ile AYNI yapin.
4. Servis hesabinizin (`service-account.json` icindeki `client_email`)
   asagidaki 4 kaynaga da erisimi olmali:
   - **STS-Envarter** ana Sheet'i - Duzenleyen (Editor)
   - **HR Master Log** Sheet'i - en az Goruntuleyen (Viewer)
   - **DRIVE_FOLDER_ID**, **TESLIM_FORM_FOLDER_ID**, **BACKUP_FOLDER_ID**
     klasorleri (Google Drive'da) - Duzenleyen (Editor), dosya
     yukleyebilmesi icin
5. `npm install && npm start`

## Drive icin OAuth kurulumu (dosya yukleme/yedekleme icin SART)

Servis hesaplarinin Drive'da kendi depolama kotasi yoktur - dosya
yuklemeye calisirsaniz "Service Accounts do not have storage quota"
hatasi alirsiniz. Bu yuzden Drive islemleri (SADECE Drive - Sheets degil)
SIZIN KENDI Google hesabiniz adina yapilir, Apps Script'in calisma
seklinin aynisi:

1. Google Cloud Console > API'ler ve Hizmetler > Kimlik Bilgileri > 'Kimlik
   Bilgisi Olustur' > **OAuth Client ID** (servis hesabindan FARKLI bir
   turdur). Uygulama turu olarak **"Desktop app"** secin, bir isim verin,
   olusturun.
2. Cikan **Client ID** ve **Client Secret** degerlerini `.env` dosyanizdaki
   `OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` satirlarina yapistirin.
3. Terminalde bu klasorde: `node oauthSetup.js`
4. Terminalde cikan uzun adresi bir tarayicida acin, KENDI Google
   hesabinizla giris yapip izin verin. "Basarili!" yazisini gordukten sonra
   terminale donun - `oauth-token.json` diye bir dosya olusmus olmali.
5. Artik `npm start` ile sunucuyu normal calistirabilirsiniz - dosya
   yukleme/yedekleme artik sizin hesabiniz uzerinden, kotasiz calisir.

Bu SADECE BIR KERE yapilir - `oauth-token.json` olustuktan sonra tekrar
giris yapmaniza gerek kalmaz (token kendi kendini otomatik yeniler).

## Durum: TUM ACTION'LAR TASINDI ✅

Apps Script'teki 37 action'in **tamami** (Envanter, Calisanlar, Ihtiyac
Listesi, Sarf Malzemeleri, Hareketler, HR Senkronizasyonu, CSV ice/disa
aktarma, dosya/form yukleme, yedekleme, Panel, TCMB kurlari, genel QR
sayfasi vb.) bu sunucuya port edildi ve calisiyor.

### Bilinen sinirlamalar
- **Teslim Formu sayaci** (`nextTeslimFormNo`) Apps Script'teki
  `TESLIM_FORM_COUNTER` ile SENKRON DEGIL - kendi yerel dosyasinda
  (`teslim-form-counter.json`) tutuluyor. Gecise gecmeden once bu dosyayi
  Apps Script'teki guncel sayiyla elle eslestirin (asagida).
- `updateEmployee`: isim degisince Envanter/Ihtiyaclar'daki eski isim
  referanslarini otomatik guncelleme henuz yok (Apps Script'te var, dusuk
  ihtimalli bir senaryo).

## GECIS: Frontend'i tamamen bu sunucuya baglamak

Tum action'lari test edip guvendiginizde:

1. `frontend/.env` (yoksa olusturun) icine: `VITE_APPS_SCRIPT_URL=http://localhost:8787`
2. **Teslim Formu sayacini eslestirin:** Apps Script > Script Properties >
   `TESLIM_FORM_COUNTER` degerini kopyalayin, bu klasorde
   `teslim-form-counter.json` diye bir dosya olusturup icine su sekilde
   yazin (X yerine o sayiyi yazin): `{"counter": X}`
3. `cd frontend && npm run build && npm run deploy` (veya sadece yerel
   test icin `npm run dev`)
4. Yerel sunucunun (`npm start`) HER ZAMAN calisir durumda olmasi gerekir -
   bilgisayariniz kapaliyken veya sunucu calismiyorken uygulama veri
   cekemez. Bilgisayar acilista otomatik baslamasini isterseniz soyleyin,
   bunu da ayarlayabiliriz.

Bu adima gecmeden once TUM ekranlari (Envanter ekle/duzenle, Calisan
ekle/duzenle, Ihtiyac ekle/duzenle/karsila, Sarf Malzemeleri, HR
Senkronizasyonu, Teslim Formu, Yedekleme, dosya yukleme) yerel sunucuya
karsi test etmenizi oneririm.
