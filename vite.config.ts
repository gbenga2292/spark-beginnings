import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// A "Redundant Fix" plugin to strip references to the deleted temp_genesis folder
const stripGhostAssets = () => ({
  name: 'strip-ghost-assets',
  transform(code: string, id: string) {
    if (code.includes('temp_genesis/public/placeholder.svg')) {
      return {
        code: code.replace(/temp_genesis\/public\/placeholder\.svg/g, ''),
        map: null
      };
    }
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [react(), tailwindcss(), stripGhostAssets()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: [
          '**/temp_genesis/**', 
          '**/temp-genesis-glow/**', 
          '**/.temp_fresh_start/**',
          '**/android/**',
          '**/ios/**',
          '**/dist/**'
        ]
      }
    },
  };
});
