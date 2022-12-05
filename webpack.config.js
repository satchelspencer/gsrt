require("dotenv").config();

const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
  entry: {
    app: path.resolve(__dirname, "./index.tsx"),
  },
  mode: "development",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-typescript",
              "@babel/preset-react",
            ],
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env": JSON.stringify({}),
      "process.env.MAPS_KEY": JSON.stringify(process.env.MAPS_KEY),
    }),
    new HtmlWebpackPlugin({ title: "guessr", inject: "body" }),
  ],
  target: "web",
};
