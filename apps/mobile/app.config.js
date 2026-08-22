const path = require('node:path');

const { config: loadEnv } = require('dotenv');

const repositoryRoot = path.resolve(__dirname, '../..');
loadEnv({ path: path.resolve(repositoryRoot, '.env.local') });
loadEnv({ path: path.resolve(repositoryRoot, '.env') });

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(googleMapsApiKey
      ? {
          config: {
            ...(config.android?.config || {}),
            googleMaps: { apiKey: googleMapsApiKey },
          },
        }
      : {}),
  },
});
