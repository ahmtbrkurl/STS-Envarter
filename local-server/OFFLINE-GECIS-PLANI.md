# STS Envanter — Tam Offline (Yerel Veritabanı) Geçiş Planı

Bu belge, hibrit kurulumdan (Google Sheets + yerel sunucu) TAM offline bir
masaüstü sisteme geçmek için adım adım plan. Her aşama kendi başına test
edilebilir — birini bitirmeden diğerine geçmeyin.

**Tahmini süre:** Birkaç oturum (bu, hibrit geçişten çok daha büyük bir iş).

---

## AŞAMA 0 — Karar ve Hazırlık

- [ ] Veritabanı teknolojisine karar verin: **SQLite** (önerilen — tek dosya,
      kurulum gerektirmez, hızlı) vs Excel dosyası (daha tanıdık ama
      eşzamanlı yazmada kırılgan)
- [ ] Multi-cihaz/kişi erişimi gerçekten gerekli mi, netleştirin — eğer
      "hayır, sadece ben ve sadece bu bilgisayar" ise plan basitleşir
- [ ] `local-server` klasörünün YEDEĞİNİ alın (mevcut hibrit kurulum çalışır
      durumda kalsın, geri dönüş şansınız olsun)

## AŞAMA 1 — Veri Taşıma (Migration)

- [ ] SQLite şemasını tasarlayın — her Google Sheets sekmesi (Envanter,
      Calisanlar, Ihtiyaclar, Hareketler, Listeler, SarfMalzemeleri,
      SarfHareketleri, Gunluk, KurGecmisi) bir SQL tablosuna karşılık gelir
- [ ] Tek seferlik bir "export" scripti yazılır: mevcut Google Sheets
      verisinin TAMAMI okunup SQLite dosyasına aktarılır
- [ ] Aktarılan veri satır satır kontrol edilir (sayılar tutuyor mu?)

## AŞAMA 2 — Backend'i Yeniden Yaz (en büyük parça)

- [ ] `sheets.js` yerine `db.js` — SQLite okuma/yazma katmanı
- [ ] `helpers.js`'teki HER fonksiyon SQL sorgularına çevrilir (createAsset,
      updateAsset, createEmployee, updateEmployee, createNeed, updateNeed,
      Sarf Malzemeleri fonksiyonları, fulfillNeed varyantları...)
- [ ] ID üretimi (nextId, nextNeedId, vb.) SQL `MAX()` sorgusuna çevrilir
- [ ] `server.js`'teki action dispatch'i yeni fonksiyonlara bağlanır

## AŞAMA 3 — İnternet Gerektiren Özellikler İçin Karar

Bunlar SQLite'a geçse bile internet ister — her biri için ayrı karar verin:

- [ ] **TCMB kuru:** internet varken çekilsin, SQLite'a önbelleklensin;
      internet yoksa "son bilinen kur" kullanılsın (uyarı ile)
- [ ] **HR Senkronizasyonu:** internet varken çalışsın; yoksa buton devre
      dışı kalsın (zaten günde birkaç kez kullanılan bir özellik)
- [ ] **Dosya yükleme/Yedekleme:** Google Drive yerine dosyalar bilgisayarda
      bir klasöre kaydedilsin (kendi yedekleme rutininizi — örn. bu klasörü
      OneDrive/Google Drive senkron klasörüne koymak — siz kurarsınız)

## AŞAMA 4 — Frontend Uyarlamaları

- [ ] Dosya/form yükleme ekranları, artık bir URL değil yerel dosya yolu
      döndüğü için küçük değişiklik gerekebilir
- [ ] "İnternet yok" durumunu kullanıcıya nazikçe gösteren bir gösterge
      eklenir (TCMB kuru/HR Sync gibi butonlar gri gösterilir)

## AŞAMA 5 — Veri Görüntüleme/Düzenleme Alışkanlığı İçin Çözüm

- [ ] Google Sheets'i artık göremeyeceğiniz için, uygulama içinde zaten olan
      tablolar (Envanter, Çalışanlar vb.) bu ihtiyacı karşılıyor mu kontrol
      edin — muhtemelen yeterli, ama "hızlı toplu düzenleme" için ek bir
      ekran isteyip istemediğinizi düşünün

## AŞAMA 6 — Yedekleme Stratejisi (KRİTİK)

- [ ] SQLite dosyası ARTIK TEK KAYNAK — kaybolursa/bozulursa tüm veri gider.
      Otomatik, düzenli bir yedekleme rutini şart:
      - [ ] Günde birkaç kez dosyanın bir kopyasını başka bir klasöre
            (örn. bir bulut-senkron klasörüne) kopyalayan basit bir script
      - [ ] Bu script'i Windows Görev Zamanlayıcı'ya (Task Scheduler)
            otomatik çalışacak şekilde eklemek

## AŞAMA 7 — Kesin Geçiş

- [ ] Hibrit kurulumla paralel birkaç gün test edin (ikisi de açık, verileri
      karşılaştırın)
- [ ] Sorun yoksa `.bat` dosyasını SQLite sunucusuna işaret edecek şekilde
      güncelleyin
- [ ] Google Sheets'i SADECE ARŞİV olarak saklayın (silmeyin!) — bir süre
      daha "eski veriye bakma" ihtiyacı olabilir

---

**Not:** Bu plan sırayla, aşama aşama uygulanmalı. Hazır olduğunuzda
"Aşama 1'e başlayalım" derseniz, o aşamayı bitirip test ettikten sonra
sıradakine geçeriz.
