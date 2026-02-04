import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

/**
 * @type {import('rollup').RollupOptions[]}
 */
const config = [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/json-selector.umd.js",
        format: "umd",
        name: "jsonSelector",
        sourcemap: true,
      },
    ],
    plugins: [
      // Convert CommonJS modules (fast-deep-equal) to ES6 for Rollup
      commonjs(),
      // Resolve and bundle node_modules dependencies into UMD build
      nodeResolve(),
      typescript({ tsconfig: "tsconfig.build.json" }),
    ],
  },
  {
    input: "src/index.ts",
    external: ["fast-deep-equal"],
    output: [
      {
        file: "dist/json-selector.esm.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      // Convert CommonJS imports to ES6 (needed even though fast-deep-equal is external)
      commonjs(),
      typescript({ tsconfig: "tsconfig.build.json" }),
    ],
  },
];

export default config;
