import {browserSelection} from "./tests/support/browser-selection";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 25000,
  expect: { timeout: 6000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4310",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: browserSelection(process.env.COMMERCE_BROWSERS).map(name=>({name,use:{...devices[name==="chromium"?"Desktop Chrome":name==="firefox"?"Desktop Firefox":"Desktop Safari"]},...(name!=="chromium"?{testMatch:/critical\.spec\.ts/}:{})})),
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4310",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
