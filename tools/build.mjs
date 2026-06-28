#!/usr/bin/env node
// Per-platform build: copies the game into dist/<platform>/, injects the correct
// portal SDK <script>, sets window.__PLATFORM__, and stamps a fresh cache-busting
// version token onto styles.css + main.js. Produces dist/<platform>.zip with
// index.html at the zip root (required by every portal).
//
// Usage:  node tools/build.mjs            (build all platforms)
//         node tools/build.mjs crazygames poki   (build a subset)

import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// Files/dirs copied into every build.
const INCLUDE = ["index.html", "styles.css", "src"];

// Portal SDK injection. __GAME_ID__ etc. must be filled by the user before upload.
const PLATFORMS = {
  standalone: { sdk: "" },
  crazygames: {
    sdk: `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>`,
  },
  gamedistribution: {
    sdk:
`<script>
  window["GD_OPTIONS"] = {
    gameId: "__GD_GAME_ID__", // <-- replace with your GameDistribution game id
    onEvent: function (e) {
      if (e.name === "SDK_GAME_PAUSE") { /* paused by ad */ }
      if (e.name === "SDK_GAME_START") { /* resume */ }
    }
  };
  (function (d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "https://html5.api.gamedistribution.com/main.min.js";
    fjs.parentNode.insertBefore(js, fjs);
  })(document, "script", "gamedistribution-jssdk");
</script>`,
  },
  poki: {
    sdk: `<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>`,
  },
  y8: {
    sdk: `<script src="//cdn.y8.com/api/sdk.js?key=__Y8_API_KEY__"></script>`,
  },
  gamepix: {
    sdk: `<script src="https://integration.gamepix.com/sdk/v3/gamepix.sdk.js"></script>`,
  },
  gamemonetize: {
    sdk:
`<script>
  window.SDK_OPTIONS = {
    gameId: "__GM_GAME_ID__", // <-- replace with your GameMonetize game id
    onEvent: function (a) {
      switch (a.name) {
        case "SDK_GAME_PAUSE": if (window.__gm_onPause) window.__gm_onPause(); break;
        case "SDK_GAME_START": if (window.__gm_onResume) window.__gm_onResume(); break;
      }
    },
  };
  (function () {
    var s = document.createElement("script"); s.src = "https://api.gamemonetize.com/sdk.js";
    document.head.appendChild(s);
  })();
</script>`,
  },
  playgama: {
    sdk: `<script src="https://bridge.cdn.playgama.com/bridge.js"></script>`,
  },
};

async function rmrf(p) {
  await fs.rm(p, { recursive: true, force: true });
}

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const e of entries) {
      await copyRecursive(path.join(src, e), path.join(dest, e));
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

function stamp(html, platform, token) {
  // Cache-busting version token.
  html = html.replace(/styles\.css\?v=\d+/g, `styles.css?v=${token}`);
  html = html.replace(/src\/main\.js\?v=\d+/g, `src/main.js?v=${token}`);
  // Platform global + SDK injection.
  const inject = `<script>window.__PLATFORM__ = ${JSON.stringify(platform)};</script>` +
    (PLATFORMS[platform].sdk ? "\n  " + PLATFORMS[platform].sdk : "");
  html = html.replace("<!-- PLATFORM_SDK_PLACEHOLDER : build.mjs injects the portal SDK <script> here -->", inject);
  return html;
}

function zipDir(dir, zipPath) {
  // Prefer the `zip` CLI (index.html ends up at the archive root). Fall back to a
  // clear message if it is unavailable so the build still produces the folder.
  try {
    if (existsSync(zipPath)) execSync(`rm -f "${zipPath}"`);
    execSync(`cd "${dir}" && zip -r -q "${zipPath}" .`, { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
}

async function buildPlatform(platform, token) {
  if (!PLATFORMS[platform]) {
    console.warn(`! Unknown platform: ${platform} (skipped)`);
    return;
  }
  const out = path.join(DIST, platform);
  await rmrf(out);
  await fs.mkdir(out, { recursive: true });

  for (const item of INCLUDE) {
    const src = path.join(ROOT, item);
    if (existsSync(src)) await copyRecursive(src, path.join(out, item));
  }

  // Stamp index.html.
  const htmlPath = path.join(out, "index.html");
  let html = await fs.readFile(htmlPath, "utf8");
  html = stamp(html, platform, token);
  await fs.writeFile(htmlPath, html, "utf8");

  const zipPath = path.join(DIST, `${platform}.zip`);
  const zipped = zipDir(out, zipPath);
  console.log(`  ✓ ${platform}  ->  dist/${platform}/${zipped ? `  (+ dist/${platform}.zip)` : "  (zip CLI unavailable — folder ready)"}`);
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length ? args : Object.keys(PLATFORMS);
  const token = Date.now().toString(36);
  await fs.mkdir(DIST, { recursive: true });
  console.log(`Building Lexivault  (version token: ${token})`);
  for (const p of targets) {
    await buildPlatform(p, token);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
