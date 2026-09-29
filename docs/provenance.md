# Dependencies and design references

Dependency selection checked on 2026-09-29. `package-lock.json` fixes the complete resolved tree; `package.json` pins direct versions. All application source and CSS product artwork were written for this project. Dependency license notices remain in the corresponding npm distributions.

| Component | Pinned version | Why this version / official reference |
| --- | --- | --- |
| React / React DOM | 17.0.2 | The component API and gradual-upgrade model being explored. [Release](https://github.com/facebook/react/releases/tag/v17.0.2), [React 17 announcement](https://legacy.reactjs.org/blog/2020/10/20/react-v17.html). |
| webpack | 5.111.1 | Maintained webpack 5 patch with Module Federation; a modern patch, not a frozen early-webpack dependency graph. [Source release](https://github.com/webpack/webpack/releases/tag/v5.111.1), [webpack 5 release](https://webpack.js.org/blog/2020-10-10-webpack-5-release/). |
| Express | 4.22.1 | Patched Express 4 API/runtime. [Source release](https://github.com/expressjs/express/releases/tag/4.22.1), [security practices](https://expressjs.com/en/advanced/best-practice-security/). |
| TypeScript | 5.9.3 | Modern strict checking while targeting ES2020. [Source release](https://github.com/microsoft/TypeScript/releases/tag/v5.9.3). |
| Playwright | 1.63.0 | Modern reproducible Chromium automation. [Source release](https://github.com/microsoft/playwright/releases/tag/v1.63.0), [test isolation](https://playwright.dev/docs/browser-contexts). |
| tsx | 4.23.15 | Execute TypeScript tests and loopback server on current Node. [Source releases](https://github.com/privatenumber/tsx/releases). |
| qs override | 6.16.0 | Explicit patched transitive dependency. The initial audit identified an older `qs`; the resolved override removes the reported advisories. [Source release](https://github.com/ljharb/qs/releases/tag/v6.16.0). |

Node 22 is the documented and CI runtime target. Local verification used the host's Node 25.7.0; actual environment details are retained in benchmark evidence. Playwright/TypeScript/runtime adjustments are modern tooling choices.

The implementation follows the official [Module Federation container and asynchronous bootstrap documentation](https://webpack.js.org/concepts/module-federation/): independent containers, unique runtime names, explicit shared React singleton, and an async bootstrap boundary. The source links above are attribution and reproducibility references, not copied application code.
