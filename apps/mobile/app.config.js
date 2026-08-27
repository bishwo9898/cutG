const path = require('node:path');

const { config: loadEnv } = require('dotenv');

const repositoryRoot = path.resolve(__dirname, '../..');
loadEnv({ path: path.resolve(__dirname, '.env.local') });
loadEnv({ path: path.resolve(repositoryRoot, '.env.local') });
loadEnv({ path: path.resolve(repositoryRoot, '.env') });

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const freeIosBuild = process.env.CUTG_FREE_IOS_BUILD === 'true';

const pluginName = (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin);
const buildPlugins = (plugins = []) =>
  plugins
    .filter((plugin) => !freeIosBuild || pluginName(plugin) !== 'expo-notifications')
    .map((plugin) => {
      if (!freeIosBuild || pluginName(plugin) !== '@stripe/stripe-react-native') return plugin;
      return ['@stripe/stripe-react-native', { enableGooglePay: true, merchantIdentifier: '' }];
    });

module.exports = ({ config }) => ({
  ...config,
  plugins: buildPlugins(config.plugins),
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
