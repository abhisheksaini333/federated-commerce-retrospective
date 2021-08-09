import path from "node:path";
export const projectRoot = path.resolve(__dirname, "..");
export type Variant = "baseline" | "optimized";
export interface RuntimeConfig { root: string; variant: Variant; ports: { host: number; catalog: number; cart: number; api: number }; shutdownMs: number; apiTimeoutMs: number }
function integer(value: string | undefined, fallback: number, name: string, max: number): number {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) throw new Error(`${name} must be an integer in 1..${max}`);
  return Number(value);
}
export function runtimeConfig(env: NodeJS.ProcessEnv = process.env, root = projectRoot): RuntimeConfig {
  const variant = env.BUILD_VARIANT ?? "optimized";
  if (variant !== "baseline" && variant !== "optimized") throw new Error("BUILD_VARIANT must be baseline or optimized");
  const ports = { host: integer(env.COMMERCE_HOST_PORT,4310,"COMMERCE_HOST_PORT",65535), catalog: integer(env.COMMERCE_CATALOG_PORT,4311,"COMMERCE_CATALOG_PORT",65535), cart: integer(env.COMMERCE_CART_PORT,4312,"COMMERCE_CART_PORT",65535), api: integer(env.COMMERCE_API_PORT,4313,"COMMERCE_API_PORT",65535) };
  if (new Set(Object.values(ports)).size !== 4) throw new Error("Commerce ports must be distinct");
  return {root:path.resolve(root),variant,ports,shutdownMs:integer(env.COMMERCE_SHUTDOWN_MS,5000,"COMMERCE_SHUTDOWN_MS",60000),apiTimeoutMs:integer(env.COMMERCE_API_TIMEOUT_MS,4500,"COMMERCE_API_TIMEOUT_MS",60000)};
}
export function origin(config: RuntimeConfig, name: keyof RuntimeConfig["ports"]): string { return `http://127.0.0.1:${config.ports[name]}`; }
export function assetDirectory(config:RuntimeConfig,name:"host"|"catalog"|"cart"):string { return path.join(config.root,"dist",config.variant,name); }
