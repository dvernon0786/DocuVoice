import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(async () => {
  const plugins: any[] = [react()]

  // Try to load optional plugins if installed. This keeps the dev server
  // working even when the packages are not yet installed.
  try {
    // vite-plugin-static-copy (ESM default)
    // @ts-ignore
    const staticCopy = await import('vite-plugin-static-copy')
    if (staticCopy && staticCopy.default) {
      plugins.push(staticCopy.default({
        targets: [
          { src: 'node_modules/@mlc-ai/web-llm/dist/*', dest: 'webllm' }
        ]
      }))
    }
  } catch (e) {
    // plugin not installed — ignore
  }

  try {
    const pwa = await import('vite-plugin-pwa')
    if (pwa && pwa.VitePWA) {
      plugins.push(pwa.VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        manifest: {
          name: 'DocuCards',
          short_name: 'DocuCards',
          description: 'Offline PDF → Smart Flashcards with OCR & FSRS',
          theme_color: '#3b82f6',
          background_color: '#0f172a',
          display: 'standalone',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        }
      }))
    }
  } catch (e) {
    // plugin not installed — ignore
  }

  return { plugins }
})
