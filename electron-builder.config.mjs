const releaseChannel = process.env.FROSTTY_RELEASE_CHANNEL === 'canary' ? 'canary' : 'stable'
const isCanary = releaseChannel === 'canary'
const updateChannel = isCanary ? 'canary' : 'latest'
const macIcon = isCanary ? 'build/icon_canary.icns' : 'build/icon.icns'
const winIcon = isCanary ? 'build/icon_canary.ico' : 'build/icon.ico'
const linuxIcon = isCanary ? 'build/icon_canary.png' : 'build/icon.png'
const macArtifactPrefix = isCanary ? 'Frostty-Canary' : 'Frostty'
const macArtifactName = `${macArtifactPrefix}-\${version}-\${arch}-\${os}.\${ext}`

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: isCanary ? 'io.frostty.app.canary' : 'io.frostty.app',
  productName: isCanary ? 'Frostty Canary' : 'Frostty',
  directories: {
    output: 'dist',
    buildResources: 'build'
  },
  files: [
    'out/**/*',
    'resources/**/*',
    '!src',
    '!**.md'
  ],
  asarUnpack: [
    'node_modules/node-pty/**'
  ],
  extraResources: [
    {
      from: 'resources',
      to: 'resources',
      filter: [
        '**/*'
      ]
    }
  ],
  publish: [
    {
      provider: 'github',
      owner: 'frostty-io',
      repo: 'frostty',
      channel: updateChannel
    }
  ],
  mac: {
    icon: macIcon,
    artifactName: macArtifactName,
    category: 'public.app-category.developer-tools',
    x64ArchFiles: '**/node_modules/node-pty/**/darwin-*/**',
    target: [
      {
        target: 'dmg',
        arch: [
          'universal'
        ]
      },
      {
        target: 'zip',
        arch: [
          'universal'
        ]
      }
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    timestamp: 'http://timestamp.apple.com/ts01',
    entitlements: 'config/entitlements.mac.plist',
    entitlementsInherit: 'config/entitlements.mac.plist',
    extendInfo: {
      NSDocumentsFolderUsageDescription: 'Frostty needs access to your Documents folder to open terminals and scan for projects in this location.',
      NSDesktopFolderUsageDescription: 'Frostty needs access to your Desktop folder to open terminals and scan for projects in this location.',
      NSDownloadsFolderUsageDescription: 'Frostty needs access to your Downloads folder to open terminals in this location.'
    }
  },
  dmg: {
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ],
    window: {
      width: 540,
      height: 380
    }
  },
  win: {
    icon: winIcon,
    target: [
      {
        target: 'nsis',
        arch: [
          'x64',
          'arm64'
        ]
      },
      {
        target: 'portable',
        arch: [
          'x64'
        ]
      }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true
  },
  linux: {
    icon: linuxIcon,
    category: 'Development',
    target: [
      {
        target: 'AppImage',
        arch: [
          'x64',
          'arm64'
        ]
      },
      {
        target: 'deb',
        arch: [
          'x64',
          'arm64'
        ]
      }
    ],
    maintainer: 'Frostty Contributors'
  }
}

export default config
