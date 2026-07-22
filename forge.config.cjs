const { FuseVersion, FuseV1Options } = require('@electron/fuses');

const packagedRoots = [
  '/dist',
  '/dist-electron',
  '/package.json',
  '/LICENSE',
  '/THIRD_PARTY_NOTICES.md',
];

module.exports = {
  packagerConfig: {
    name: 'INTERRO',
    executableName: 'INTERRO',
    asar: true,
    prune: true,
    ignore(filePath) {
      if (!filePath) return false;
      const normalized = filePath.replaceAll('\\', '/');
      if (
        normalized.startsWith('/dist-electron/') &&
        normalized.endsWith('.test.js')
      ) {
        return true;
      }
      return !packagedRoots.some(
        (root) => normalized === root || normalized.startsWith(`${root}/`),
      );
    },
  },
  makers: [],
  plugins: [
    {
      name: '@electron-forge/plugin-fuses',
      config: {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      },
    },
  ],
};
