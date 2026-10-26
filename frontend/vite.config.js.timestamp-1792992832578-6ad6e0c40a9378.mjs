// vite.config.js
import { defineConfig } from "file:///C:/Users/abural/Desktop/STS-Envarter/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/abural/Desktop/STS-Envarter/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/abural/Desktop/STS-Envarter/frontend/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "index.html",
        // exceljs gibi buyuk kutuphaneler eklendikce JS paketi 2 MB varsayilan
        // sinirini asabiliyor - asilirsa build tamamen HATA VERIP durur (sessizce
        // degil, "Configure workbox.maximumFileSizeToCacheInBytes" hatasi ile).
        // Sinir once 10 MB'a cikariliyor, ileride buyurse burayi artirin.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      },
      manifest: {
        name: "BT Varlik Yonetimi",
        short_name: "BT Envanter",
        description: "STS BT Varlik Yonetimi Sistemi",
        start_url: ".",
        display: "standalone",
        background_color: "#F5F6F8",
        theme_color: "#1E3A52",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      }
    })
  ],
  base: "./"
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxhYnVyYWxcXFxcRGVza3RvcFxcXFxTVFMtRW52YXJ0ZXJcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGFidXJhbFxcXFxEZXNrdG9wXFxcXFNUUy1FbnZhcnRlclxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvYWJ1cmFsL0Rlc2t0b3AvU1RTLUVudmFydGVyL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5cbi8vIE5PVDogSGFzaFJvdXRlciBrdWxsYW5kaWdpbWl6IGljaW4gYmFzZSB5b2x1IGdvcmVjZWxpICguLykgYmlyYWtpeW9ydXogLVxuLy8gYnUgc2F5ZWRlIEFZTkkgZGVybGVtZSBoZW0gR2l0SHViIFBhZ2VzJ3RlIChoZXJoYW5naSBiaXIgYWx0IHlvbGRhKSBoZW0gZGVcbi8vIHllcmVsIHN1bnVjdWRhIChzZXJ2ZXIvKSBzb3J1bnN1eiBjYWxpc2lyLCBheXJpIGF5cmkgYXlhciBnZXJla21lei5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICAvLyAnbnBtIHJ1biBkZXYnIHNpcmFzaW5kYSBzZXJ2aXMgY2FsaXNhbmluaSAoc2VydmljZSB3b3JrZXIpIEtBWUlUIEVUTUUgLVxuICAgICAgLy8gYWtzaSBoYWxkZSB0YXJheWljaWRhIG9uY2VraSBiaXIgeml5YXJldHRlbiBrYWxtYSBzZXJ2aXMgY2FsaXNhbmkgKHZleWFcbiAgICAgIC8vIGJ1IGF5YXIgb2xtYWRhbiBidXJhZGEgb2x1c2FuIHllbmkgYmlyIHRhbmUpLCBzYXlmYXlpIG9uYmVsbGVrdGVuXG4gICAgICAvLyBzZXJ2aXMgZWRpcCBWaXRlJ2luIGNhbmxpIHllbmlsZW1lIChITVIpIGd1bmNlbGxlbWVsZXJpbmkgZ29zdGVybWV5ZWJpbGlyLlxuICAgICAgLy8gU2VydmlzIGNhbGlzYW5pIFNBREVDRSBnZXJjZWsgJ25wbSBydW4gYnVpbGQnIChHaXRIdWIgUGFnZXMpIGNpa3Rpc2luZGEgY2FsaXNpci5cbiAgICAgIGRldk9wdGlvbnM6IHsgZW5hYmxlZDogZmFsc2UgfSxcbiAgICAgIC8vIFV5Z3VsYW1heWkgYmlyIGtlcmUgeml5YXJldCBldHRpa3RlbiBzb25yYSBpbnRlcm5ldHNpeiBkZSBhY2lsYWJpbG1lc2kgaWNpblxuICAgICAgLy8gdHVtIGRlcmxlbm1pcyBkb3N5YWxhcmkgKEpTL0NTUy9IVE1MKSB0YXJheWljaWRhIG9uYmVsbGVrbGVyLiBBUEkgY2FncmlsYXJpXG4gICAgICAvLyAoQXBwcyBTY3JpcHQpIGJ1IGthcHNhbSBkaXNpbmRhIC0gb25sYXIgaGFsYSBpbnRlcm5ldCBnZXJla3RpcmlyLlxuICAgICAgd29ya2JveDoge1xuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsc3ZnLHBuZyxpY299J10sXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICdpbmRleC5odG1sJyxcbiAgICAgICAgLy8gZXhjZWxqcyBnaWJpIGJ1eXVrIGt1dHVwaGFuZWxlciBla2xlbmRpa2NlIEpTIHBha2V0aSAyIE1CIHZhcnNheWlsYW5cbiAgICAgICAgLy8gc2luaXJpbmkgYXNhYmlsaXlvciAtIGFzaWxpcnNhIGJ1aWxkIHRhbWFtZW4gSEFUQSBWRVJJUCBkdXJ1ciAoc2Vzc2l6Y2VcbiAgICAgICAgLy8gZGVnaWwsIFwiQ29uZmlndXJlIHdvcmtib3gubWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXNcIiBoYXRhc2kgaWxlKS5cbiAgICAgICAgLy8gU2luaXIgb25jZSAxMCBNQidhIGNpa2FyaWxpeW9yLCBpbGVyaWRlIGJ1eXVyc2UgYnVyYXlpIGFydGlyaW4uXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAxMCAqIDEwMjQgKiAxMDI0XG4gICAgICB9LFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ0JUIFZhcmxpayBZb25ldGltaScsXG4gICAgICAgIHNob3J0X25hbWU6ICdCVCBFbnZhbnRlcicsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnU1RTIEJUIFZhcmxpayBZb25ldGltaSBTaXN0ZW1pJyxcbiAgICAgICAgc3RhcnRfdXJsOiAnLicsXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyNGNUY2RjgnLFxuICAgICAgICB0aGVtZV9jb2xvcjogJyMxRTNBNTInLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHsgc3JjOiAnaWNvbi5zdmcnLCBzaXplczogJ2FueScsIHR5cGU6ICdpbWFnZS9zdmcreG1sJywgcHVycG9zZTogJ2FueSBtYXNrYWJsZScgfVxuICAgICAgICBdXG4gICAgICB9XG4gICAgfSlcbiAgXSxcbiAgYmFzZTogJy4vJ1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFVLFNBQVMsb0JBQW9CO0FBQ2xXLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFLeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQU1kLFlBQVksRUFBRSxTQUFTLE1BQU07QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUk3QixTQUFTO0FBQUEsUUFDUCxjQUFjLENBQUMsZ0NBQWdDO0FBQUEsUUFDL0Msa0JBQWtCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQUtsQiwrQkFBK0IsS0FBSyxPQUFPO0FBQUEsTUFDN0M7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLFNBQVM7QUFBQSxRQUNULGtCQUFrQjtBQUFBLFFBQ2xCLGFBQWE7QUFBQSxRQUNiLE9BQU87QUFBQSxVQUNMLEVBQUUsS0FBSyxZQUFZLE9BQU8sT0FBTyxNQUFNLGlCQUFpQixTQUFTLGVBQWU7QUFBQSxRQUNsRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDQSxNQUFNO0FBQ1IsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
