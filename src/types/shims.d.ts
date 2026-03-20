// Local shims for optional/missing modules to keep TypeScript happy
declare module 'react' {
  export * from 'any'
}
declare module 'react-dom/client' {
  const anything: any
  export default anything
}
declare module 'react/jsx-runtime' {
  export function jsx(...args: any[]): any
  export function jsxs(...args: any[]): any
  export function jsxDEV(...args: any[]): any
}
declare module 'pdfjs-dist'
declare module 'tesseract.js'
declare module '@mlc-ai/web-llm'
declare module 'ts-fsrs'
declare module 'vite-plugin-static-copy'
declare module 'vite-plugin-pwa'

// Minimal JSX namespace so TS doesn't complain about IntrinsicElements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}

export {}
