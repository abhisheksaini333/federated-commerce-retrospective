const path = require("node:path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { ModuleFederationPlugin } = webpack.container;

module.exports = (env = {}, argv = {}) => {
  const baseline = env.baseline === "1";
  const root = baseline ? "dist/baseline" : "dist/optimized";
  const shared = {
    react: { singleton: true, strictVersion: true, requiredVersion: "17.0.2" },
    "react-dom": {
      singleton: true,
      strictVersion: true,
      requiredVersion: "17.0.2",
    },
  };
  const common = (name) => ({
    name,
    mode: argv.mode || "production",
    entry: name === "host" ? "./apps/host/index.ts" : "./apps/remote-entry.ts",
    output: {
      path: path.resolve(__dirname, root, name),
      filename: "[name].[contenthash:8].js",
      chunkFilename: "[name].[contenthash:8].js",
      uniqueName: `fieldwork_${name}`,
      publicPath: "auto",
      clean: true,
      chunkLoadTimeout: 5000,
    },
    resolve: { extensions: [".tsx", ".ts", ".js"] },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: { loader: "ts-loader", options: { transpileOnly: true } },
        },
        { test: /\.css$/, use: ["style-loader", "css-loader"] },
      ],
    },
    devtool: "source-map",
    performance: {
      hints: "warning",
      maxEntrypointSize: 250000,
      maxAssetSize: 250000,
    },
    stats: "minimal",
  });
  return [
    {
      ...common("host"),
      plugins: [
        new ModuleFederationPlugin({
          name: "host",
          shared,
          remotes: {
            catalog: "catalog@http://127.0.0.1:4311/remoteEntry.js",
            cart: "cart@http://127.0.0.1:4312/remoteEntry.js",
          },
        }),
        new webpack.DefinePlugin({ __EAGER_CART__: JSON.stringify(baseline) }),
        new HtmlWebpackPlugin({
          title: "Fieldwork Supply — Good things, for everyday.",
          template: "apps/host/index.html",
        }),
      ],
    },
    {
      ...common("catalog"),
      plugins: [
        new ModuleFederationPlugin({
          name: "catalog",
          filename: "remoteEntry.js",
          exposes: { "./Catalog": "./apps/catalog/Catalog.tsx" },
          shared,
        }),
      ],
    },
    {
      ...common("cart"),
      plugins: [
        new ModuleFederationPlugin({
          name: "cart",
          filename: "remoteEntry.js",
          exposes: { "./Cart": "./apps/cart/Cart.tsx" },
          shared,
        }),
      ],
    },
  ];
};
