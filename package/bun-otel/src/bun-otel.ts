import {
  type Server,
  type PluginBuilder,
  type BunPlugin,
  type BunRegisterPlugin,
  type PluginConstraints,
  plugin,
} from "bun";
import { trace, context } from "@opentelemetry/api";

export function BunOtel<T>() {
  return (server: Server<T>) => {
    console.log("\n------server.start---\n", server, "\n--------server.end-----\n");
    return server;
  };
}

export const BunOtelPlugin = <T extends BunPlugin, K>(options: T) => {
  let build_options: PluginBuilder;

  return plugin({
    name: "BunOtelPlugin",
    setup(build: PluginBuilder) {
      // Wrap onStart to instrument bundle start time
      const originalOnStart = build.onStart;
      build.onStart = (callback) => {
        return originalOnStart.call(build, async () => {
          const startTime = performance.now();
          console.log(`[OTEL] Plugin started: ${options.name}`);

          await callback();

          const duration = performance.now() - startTime;
          console.log(`[OTEL] Plugin onStart completed in ${duration}ms`);
        });
      };

      // Wrap onResolve to track module resolution
      const originalOnResolve = build.onResolve;
      build.onResolve = (args, callback) => {
        return originalOnResolve.call(build, args, (resolveArgs) => {
          const startTime = performance.now();
          const result = callback(resolveArgs);
          const duration = performance.now() - startTime;

          console.log(`[OTEL] Resolved ${resolveArgs.path} in ${duration}ms`);
          return result;
        });
      };

      // Wrap onLoad to track module loading
      const originalOnLoad = build.onLoad;
      build.onLoad = (args, callback) => {
        return originalOnLoad.call(build, args, async (loadArgs) => {
          const startTime = performance.now();
          const result = await callback(loadArgs);
          const duration = performance.now() - startTime;

          console.log(`[OTEL] Loaded ${loadArgs.path} in ${duration}ms`);
          return result;
        });
      };

      // Call the original plugin's setup
      if (options.setup) {
        options.setup(build);
      }
    },
  });
};
