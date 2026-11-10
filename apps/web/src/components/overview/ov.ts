import "./overview-painel.css";

/**
 * Tailwind turbopack treats CSS modules as global CSS and drops the class map.
 * Class names in overview-painel.css are used as-is.
 */
export const s = new Proxy({} as Record<string, string>, {
  get: (_target, prop: string | symbol) => (typeof prop === "string" ? prop : ""),
});
