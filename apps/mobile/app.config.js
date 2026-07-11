const path = require('node:path');

const { config: loadEnv } = require('dotenv');

const app = require('./app.json');

const repositoryRoot = path.resolve(__dirname, '../..');
loadEnv({ path: path.resolve(repositoryRoot, '.env.local') });
loadEnv({ path: path.resolve(repositoryRoot, '.env') });

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

module.exports = {
  ...app.expo,
  android: {
    ...app.expo.android,
    ...(googleMapsApiKey
      ? { config: { ...(app.expo.android.config || {}), googleMaps: { apiKey: googleMapsApiKey } } }
      : {}),
  },
};
