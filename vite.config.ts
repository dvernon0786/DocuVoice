import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(async () => {
  const plugins: any[] = [react()]

  // vite-plugin-pwa (optional — graceful if not installed)
  try {
    const pwa = await import('vite-plugin-pwa')
    if (pwa?.VitePWA) {
      plugins.push(pwa.VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        },
        manifest: {
          name: 'MedCards',
          short_name: 'MedCards',
          description: 'Offline PDF → Smart Flashcards with OCR & FSRS',
          theme_color: '#3b7cf8',
          background_color: '#080c14',
          display: 'standalone',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        },
      }))
    }
  } catch {
    // plugin not installed — skip
  }

  return {
    plugins,
    build: {
      // Raise chunk warning limit — pdf.js and tesseract are inherently large
      chunkSizeWarningLimit: 4000,
      rollupOptions: {
        // Mark heavy optional deps as external — loaded at runtime via CDN / window globals
        // Users who want WebLLM or Piper can load them via <script> in index.html
        external: [
          '@mlc-ai/web-llm',
          'piper-tts-web',
        ],
        output: {
          // Manual chunking to avoid one giant bundle
          manualChunks: {
            'pdfjs':     ['pdfjs-dist'],
            'tesseract': ['tesseract.js'],
            'react':     ['react', 'react-dom'],
            'fsrs':      ['ts-fsrs'],
          },
        },
      },
    },
    optimizeDeps: {
      // Don't pre-bundle these — they're either external or loaded dynamically
      exclude: ['@mlc-ai/web-llm', 'piper-tts-web'],
    },
  }
})
