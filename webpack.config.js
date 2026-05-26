const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/**
 * React Native and Expo packages that ship as JSX/modern JS and must be
 * transpiled by Babel even though they live in node_modules.
 */
const TRANSPILE_PACKAGES = [
  'react-native',
  'react-native-web',
  '@react-native',
  '@react-navigation',
  'expo',
  '@expo',
  'expo-router',
  'expo-status-bar',
  'expo-constants',
  'expo-linking',
  'expo-modules-core',
  'expo-font',
  'expo-haptics',
  'expo-image',
  'expo-splash-screen',
  'expo-symbols',
  'expo-system-ui',
  'expo-web-browser',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
  '@react-native-async-storage',
];

const transpileRegex = new RegExp(
  `node_modules[/\\\\](?!(${TRANSPILE_PACKAGES.join('|')}))`
);

module.exports = {
  entry: path.resolve(__dirname, 'index.web.js'),

  mode: 'production',

  resolve: {
    // Prefer .web.* variants first so platform-specific overrides are picked up
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      '.web.jsx',
      '.tsx',
      '.ts',
      '.js',
      '.jsx',
      '.json',
    ],
    alias: {
      // Redirect all react-native imports to react-native-web
      'react-native$': 'react-native-web',
      // Mirror the tsconfig @/ path alias
      '@': path.resolve(__dirname),
    },
  },

  module: {
    rules: [
      // TypeScript + JSX — includes specific node_modules that need transpiling
      {
        test: /\.[jt]sx?$/,
        exclude: transpileRegex,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            // babel-preset-expo handles TS, JSX, and React Native specifics
            presets: ['babel-preset-expo'],
          },
        },
      },
      // Images
      {
        test: /\.(png|jpg|jpeg|gif|webp|ico)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/images/[name].[hash][ext]' },
      },
      // Fonts
      {
        test: /\.(ttf|otf|woff|woff2|eot)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/fonts/[name].[hash][ext]' },
      },
      // SVG as resource (avoids needing @svgr/webpack)
      {
        test: /\.svg$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/svg/[name].[hash][ext]' },
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'web', 'index.html'),
      filename: 'index.html',
    }),
  ],

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true,
    publicPath: '/',
  },

  // Suppress size warnings — RN Web bundles are large by nature
  performance: { hints: false },
};
