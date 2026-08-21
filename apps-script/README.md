# Backend Kurulumu (Google Apps Script)

Bu adimlar sonunda elinizde, verileri Google Sheets ve Drive'da tutan bir "API" adresi olacak.

## 1. Google Sheet olusturun

1. Google Drive'da yeni bir Google Sheets dosyasi olusturun (orn. `BT_Varlik_Yonetimi`).
2. Ustteki menude **Uzantilar (Extensions) → Apps Script** yolunu izleyin.
3. Acilan editorde varsayilan `Code.gs` icerigini silin, bu klasordeki `Code.gs` dosyasinin
   tamamini yapistirin.
4. Sol ustteki proje adina tiklayip `BT Varlik Yonetimi Backend` gibi bir isim verin.

## 2. Ayarlari girin (Script Properties)

Apps Script editorunde sol menuden **Proje Ayarlari (Project Settings)** (dişli/çark ikonu) →
asagi kaydirin, **Script Properties** bolumunden **Add script property** ile şunlari ekleyin:

| Property adi | Deger |
|---|---|
| `APP_TOKEN` | Uygulamaya giris icin kullanacaginiz gizli anahtar. Ornegin: `sts-bt-2026-x7k` gibi tahmin edilmesi zor bir metin. |
| `DRIVE_FOLDER_ID` | Faturalarin yuklenecegi Drive klasorunun ID'si (asagida nasil bulunacagi anlatiliyor). |

**Drive klasoru ID'si nasil bulunur:** Drive'da yeni bir klasor olusturun (orn. `BT-Varlik-Belgeler`),
icine girin, adres cubugundaki linkin son parcasi klasor ID'sidir:
`https://drive.google.com/drive/folders/BURASI_ID`

## 3. Sheet'leri otomatik olusturun

1. Apps Script editorunde ust taraftaki fonksiyon secim kutusundan `setupSheets` fonksiyonunu secin.
2. **Calistir (Run)** butonuna basin.
3. Ilk calistirmada Google izin isteyecek: hesabinizi secin, "Gelismis" (Advanced) → "Guvenli degil,
   yine de devam et" diyerek izin verin (bu normal, cunku kendi yazdiginiz script kendi sheet'inize erisiyor).
4. Calisma bittiginde Sheet'e donup `Envanter`, `Calisanlar`, `Hareketler`, `Listeler` sekmelerinin
   olustugunu goreceksiniz. `Listeler` sekmesi varsayilan kategori/lokasyon/durum listeleriyle
   onceden doldurulmus olacak — dilediginiz gibi duzenleyebilirsiniz (yeni kategori eklemek,
   lokasyon eklemek gibi).

## 4. Web App olarak yayinlayin

1. Sag ustteki **Dagit (Deploy) → Yeni dagitim (New deployment)**.
2. Tip olarak **Web app** secin.
3. **Execute as:** "Me" (kendi hesabiniz) — bu, backend'in sizin adiniza Sheet/Drive'a erismesini saglar.
4. **Who has access:** "Anyone" secin. (Endise etmeyin: kod icindeki `APP_TOKEN` kontrolu sayesinde
   token bilmeyen kimse veriye erisemez — sadece QR kod ile acilan `publicAsset` islemi tokensiz calisir,
   ki bu zaten amaclanan davranis.)
5. **Dagit (Deploy)** butonuna basin, izinleri onaylayin.
6. Cikan **Web app URL**'ini kopyalayin — `https://script.google.com/macros/s/AAAA.../exec` seklinde
   olacak. Bu adresi frontend kurulumunda kullanacaksiniz.

## 5. Guncelleme yaptiginizda

Kodda degisiklik yaptiginizda mevcut URL'in calismaya devam etmesi icin **Dagit → Dagitimlari yonet
(Manage deployments) → duzenle (kalem ikonu) → Version: New version → Dagit** yolunu izleyin.
Yeni bir deployment olusturmayin, URL degisir.

## Not: Guvenlik

- `APP_TOKEN` degerini kimseyle paylasmayin, sadece uygulamayi kullanacak birkac kisiye verin.
- Anahtar sizmis gibi hissediyorsaniz Script Properties'ten `APP_TOKEN` degerini degistirin —
  eski anahtarla giris yapilamaz hale gelir.
- QR kod sayfasi (`publicAsset`) kasitli olarak herkese acik: fiyat, tedarikci, fatura linki gibi
  bilgileri DONMEZ, sadece kategori/marka/model/durum/atanan kisi gorunur.
