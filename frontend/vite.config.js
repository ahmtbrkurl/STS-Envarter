import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// NOT: HashRouter kullandigimiz icin base yolu goreceli (./) birakiyoruz -
// bu sayede AYNI derleme hem GitHub Pages'te (herhangi bir alt yolda) hem de
// yerel sunucuda (server/) sorunsuz calisir, ayri ayri ayar gerekmez.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 'npm run dev' sirasinda servis calisanini (service worker) KAYIT ETME -
      // aksi halde tarayicida onceki bir ziyaretten kalma servis calisani (veya
      // bu ayar olmadan burada olusan yeni bir tane), sayfayi onbellekten
      // servis edip Vite'in canli yenileme (HMR) guncellemelerini gostermeyebilir.
      // Servis calisani SADECE gercek 'npm run build' (GitHub Pages) ciktisinda calisir.
      devOptions: { enabled: false },
      // Uygulamayi bir kere ziyaret ettikten sonra internetsiz de acilabilmesi icin
      // tum derlenmis dosyalari (JS/CSS/HTML) tarayicida onbellekler. API cagrilari
      // (Apps Script) bu kapsam disinda - onlar hala internet gerektirir.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        // exceljs gibi buyuk kutuphaneler eklendikce JS paketi 2 MB varsayilan
        // sinirini asabiliyor - asilirsa build tamamen HATA VERIP durur (sessizce
        // degil, "Configure workbox.maximumFileSizeToCacheInBytes" hatasi ile).
        // Sinir once 10 MB'a cikariliyor, ileride buyurse burayi artirin.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      },
      manifest: {
        name: 'BT Varlik Yonetimi',
        short_name: 'BT Envanter',
        description: 'STS BT Varlik Yonetimi Sistemi',
        start_url: '.',
        display: 'standalone',
        background_color: '#F5F6F8',
        theme_color: '#1E3A52',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ],
  base: './'
});
