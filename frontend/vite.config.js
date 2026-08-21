import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOT: repo adiniz "envanter-app" degilse asagidaki base degerini
// "/REPO-ADINIZ/" olarak guncelleyin (basinda ve sonunda / olacak sekilde).
export default defineConfig({
  plugins: [react()],
  base: '/STS-Envarter/'
});
