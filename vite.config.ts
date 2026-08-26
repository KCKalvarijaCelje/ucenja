import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

// Sync logo assets from kck if available
try {
  const masterLogo = path.resolve(__dirname, '../kck/public/KCK-logo-rdec_small.png');
  const masterSecondary = path.resolve(__dirname, '../kck/public/KCK-logo-rdec-sekundaren_small.png');
  const targetDir = path.resolve(__dirname, 'public');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  if (fs.existsSync(masterLogo)) {
    fs.copyFileSync(masterLogo, path.join(targetDir, 'KCK-logo-rdec_small.png'));
  }
  if (fs.existsSync(masterSecondary)) {
    fs.copyFileSync(masterSecondary, path.join(targetDir, 'KCK-logo-rdec-sekundaren_small.png'));
  }
} catch (e) {
  // ignore
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
