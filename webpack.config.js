const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const path = require("path");

module.exports = {
  mode: 'production',
  entry: {
    options: "./src/options/options.js",
    popup: "./src/popup/popup.js",
    content: "./src/content.js",
    background: "./src/background.js"
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
        minify: true,
    }),
    new HtmlWebpackPlugin({
      filename: "options.html",
      template: "src/options/options.html",
      chunks: ["options"],
    }),
    new HtmlWebpackPlugin({
      filename: "popup.html",
      template: "src/popup/popup.html",
      chunks: ["popup"],
    }),
    new CopyPlugin({
        patterns: [
          { from: 'src/manifest.json', to: 'manifest.json' },
          { from: 'src/icon.png', to: 'icon128.png' },
          { from: 'src/assets/thumbnail-missing-on-cdn.png', to: 'assets/thumbnail-missing-on-cdn.png' }
        ],
      }),
  ],
};
