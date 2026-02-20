/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

declare const __FROSTTY_BUILD_SHA__: string
declare const __FROSTTY_BUILD_DATE__: string
declare const __FROSTTY_RELEASE_CHANNEL__: string
