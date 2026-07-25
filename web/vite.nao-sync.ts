import type { Plugin } from "vite";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type SyncBody = {
  files?: Record<string, string>;
  meta?: { nEmpresas?: number; nAvaliacoes?: number };
};

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Em `npm run dev`, POST /api/nao-sync grava CSVs, rebuild DuckDB e reinicia o container. */
export function naoSyncPlugin(repoRoot: string): Plugin {
  return {
    name: "nao-sync-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== "/api/nao-sync" || req.method !== "POST") {
          next();
          return;
        }
        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as SyncBody & { probe?: boolean };
          if (body.probe) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, writeTarget: "disk" }));
            return;
          }
          const dataDir = path.join(repoRoot, "nao", "data");
          fs.mkdirSync(dataDir, { recursive: true });
          const files = body.files || {};
          for (const [name, content] of Object.entries(files)) {
            const safe = path.basename(name);
            if (!safe.endsWith(".csv")) continue;
            fs.writeFileSync(path.join(dataDir, safe), content, "utf8");
          }

          const build = spawnSync(
            "python3",
            [path.join(repoRoot, "nao", "scripts", "build_duckdb.py")],
            { cwd: repoRoot, encoding: "utf8" }
          );
          if (build.status !== 0) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                message: build.stderr || build.stdout || "Falha no DuckDB",
              })
            );
            return;
          }

          const restart = spawnSync(
            "docker",
            ["compose", "-f", "docker-compose.nao.yml", "restart"],
            { cwd: repoRoot, encoding: "utf8" }
          );

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: true,
              message: `Sincronizado com Nao: ${body.meta?.nEmpresas ?? "?"} empresas, ${body.meta?.nAvaliacoes ?? "?"} avaliações.${
                restart.status === 0 ? " Container reiniciado." : " DuckDB ok (reinicie o Docker manualmente)."
              }`,
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              message: err instanceof Error ? err.message : String(err),
            })
          );
        }
      });
    },
  };
}
