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
    "content-exl": "./src/content/content-exl.js",
    "content-jira": "./src/content/content-jira.js",
    background: "./src/background.js"
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
            test: /\.scss$/,
            use: [
              MiniCssExtractPlugin.loader,
              "css-loader",
              "sass-loader"
            ]
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
        filename: "[name].css",
        chunkFilename: "[id].css"
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
        ],
      }),
  ]
};
