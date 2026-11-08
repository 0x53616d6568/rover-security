import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

/**
 * `public/cockpit.html` is copied as-is and is not part of Vite's module graph.
 * Editing it makes Vite send a full reload aimed at `/public/cockpit.html`,
 * which the open page ignores. Broadcast a custom event instead so the
 * dashboard can reload only the 3D iframe without dropping the MQTT session.
 */
function reloadCockpitHud(): Plugin {
  let hudFile = "";
  return {
    name: "reload-cockpit-hud",
    configResolved(config) {
      hudFile = path.resolve(config.publicDir, "cockpit.html");
    },
    configureServer(server: ViteDevServer) {
      const notify = (file: string) => {
        if (path.resolve(file) !== hudFile) return;
        server.hot.send("cockpit-hud-update");
        server.config.logger.info("cockpit HUD changed — reloading iframe", {
          timestamp: true,
        });
      };
      server.watcher.on("change", notify);
      server.watcher.on("add", notify);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl(), reloadCockpitHud()],
  server: { host: true },
});
