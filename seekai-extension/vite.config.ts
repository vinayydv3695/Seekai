import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        { src: 'icons', dest: '.' },
        { src: 'manifest.json', dest: '.' }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        newtab: './src/newtab.html',
        settings: './src/settings.html',
        background: './src/background.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background.js name for service worker
          if (chunkInfo.name === 'background') {
            return 'src/background.js';
          }
          return 'src/[name].js';
        },
        chunkFileNames: 'src/chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Keep HTML files in src directory
          if (assetInfo.name && assetInfo.name.endsWith('.html')) {
            return 'src/[name][extname]';
          }
          // Keep CSS in src directory
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'src/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    // Ensure proper module format for Chrome extension
    target: 'esnext',
    minify: false, // Easier debugging during development
    sourcemap: true
  }
});
