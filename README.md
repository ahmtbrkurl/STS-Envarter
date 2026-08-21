# BT Varlik Yonetimi - Envanter Uygulamasi

GitHub Pages'te yayinlanan, verilerini Google Sheets + Google Drive'da tutan bir BT envanter
takip uygulamasi.

## Mimari

```
[ React (GitHub Pages) ]  --fetch-->  [ Google Apps Script Web App ]  --->  [ Google Sheets + Drive ]
      Frontend                              Backend / API                     Veri deposu
```

- **Frontend**: GitHub Pages'te barinan statik bir React uygulamasi.
- **Backend**: Google Apps Script ile yazilmis, Sheet'e bagli bir "Web App" — ayri sunucu
  kiralamaya gerek yok.
- **Veri**: Tum envanter, calisan ve hareket kayitlari Google Sheets'te; faturalar/belgeler
  Google Drive'da.
- **Kimlik dogrulama**: Merkezi tek bir "erisim anahtari" (APP_TOKEN) ile — 5 kisiye kadar
  kucuk ekipler icin en pratik yontem.

## Kurulum sirasi

### 1. Backend (Google Apps Script)

`apps-script/README.md` dosyasindaki adimlari izleyin. Sonunda elinizde bir
**Web App URL**'i olacak (`https://script.google.com/macros/s/.../exec`).

### 2. Bu kodu kendi GitHub reponuza yukleyin

```bash
git init
git add .
git commit -m "İlk kurulum: BT Varlik Yonetimi"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/REPO_ADINIZ.git
git push -u origin main
```

### 3. Repo adini vite.config.js'e yazin

`frontend/vite.config.js` icindeki `base` degerini repo adinizla degistirin:

```js
base: '/REPO_ADINIZ/'
```

### 4. Apps Script URL'ini GitHub Secret olarak ekleyin

GitHub reponuzda: **Settings → Secrets and variables → Actions → New repository secret**

- Name: `VITE_APPS_SCRIPT_URL`
- Value: 2. adimda kopyaladiginiz Apps Script Web App URL'i

### 5. GitHub Pages'i acin

**Settings → Pages → Build and deployment → Source: "GitHub Actions"** secin.

`main` dalina her push yaptiginizda `.github/workflows/deploy.yml` otomatik olarak siteyi
derleyip yayinlayacak. Birkac dakika icinde uygulamaniz
`https://KULLANICI_ADINIZ.github.io/REPO_ADINIZ/` adresinde yayinda olacak.

### 6. Yerelde denemek isterseniz

```bash
cd frontend
npm install
echo "VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec" > .env.local
npm run dev
```

### 7. Uygulamaya giris

Tarayicidan siteyi acin, adinizi ve `apps-script/README.md`'de belirledi­giniz `APP_TOKEN`
degerini girin.

## Faz 1 kapsami

- **Envanter**: benzersiz otomatik ID (`IT-0001`), kategori, marka, model, seri no, renk,
  hostname, durum, lokasyon, atanan kisi (veya "Genel Kullanim"), atama/satin alma/teslim
  tarihleri, coklu para birimiyle fiyat (TRY/USD/EUR/RUB), garanti bitis tarihi.
- **QR kod**: Her varliğin detay sayfasinda otomatik olusan, yazdirilabilir bir QR kod. Okutan
  herkes (giris yapmadan) o cihazin kategori/marka/model/durum/atanan kisisini gorur — fiyat ve
  tedarikci bilgisi gizli tutulur.
- **Fatura/belge yukleme**: Varlik detay sayfasindan dosya yukleyin, otomatik olarak Drive'daki
  klasore kaydedilir ve linki o varlığa eklenir.
- **Calisanlar**: ad soyad, telefon, e-posta, aktif/pasif durumu; her calisanin uzerine kayitli
  kac varlik oldugu goruntulenir.
- **Hareketler**: bir cihazin bugune kadar kimler tarafindan kullanildigi, ne zaman el
  degistirdigi otomatik olarak kaydedilir (atama, transfer, durum degisikligi).
- **Panel (Dashboard)**: toplam varlik, durum/kategori/lokasyon dagilimi, para birimine gore
  toplam deger, 30 gun icinde garantisi bitecek cihaz sayisi.
- **Raporlama**: Envanter listesinden filtrelenmis sonuclari CSV olarak disa aktarabilirsiniz
  (Excel'de acilir). Daha detayli raporlama Faz 2'de eklenebilir.

## Sonraki fazlar icin adaylar

- Lisans takibi, IP adres yonetimi (mevcut Excel'inizdeki gibi)
- Teslim/iade formu (imza/onay akisi)
- Rol bazli yetkilendirme (goruntuleyen / duzenleyen / admin)
- Detayli raporlama (grafikli, tarih araligina gore)
- Kritik uyarilar (garanti bitimi, dusuk stok) icin e-posta bildirimi
