module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'expo-router/babel',
      ['react-native-worklets-core/plugin'],
      'react-native-reanimated/plugin',
    ],
  };
};
