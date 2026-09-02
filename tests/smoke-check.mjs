import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const read = (file) => readFileSync(join(root, file), "utf8");

for (const file of readdirSync(root).filter((name) => name.endsWith(".js"))) {
  const result = spawnSync(process.execPath, ["--check", join(root, file)], { encoding: "utf8" });
  check(result.status === 0, `${file}: JavaScript syntax error\n${result.stderr}`);
}

const index = read("index.html");
const app = read("app.js");
const performance = read("performance.js");
const elegantUi = read("elegant-ui.css");
const ids = [...index.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, position) => ids.indexOf(id) !== position))];
check(duplicateIds.length === 0, `index.html: duplicate IDs: ${duplicateIds.join(", ")}`);

for (const route of ["home", "ranking", "genres", "personalized", "favorites", "request", "listen"]) {
  check(index.includes(`data-screen="${route}"`), `index.html: missing ${route} screen`);
}
for (const id of ["songRequestForm", "songSearchTitle", "japanListener", "overseasListener"]) {
  check(index.includes(`id="${id}"`), `index.html: missing #${id}`);
}
check(!/type\s*=\s*["']overseas["']/.test(app), "app.js: forced overseas audience assignment returned");
check(app.includes('"request"'), "app.js: request route is not registered");
check(app.includes('rpc/save_listener_profile'), "app.js: profile save is not atomic");
check(
  app.indexOf("requestedInterfaceLanguage") < app.indexOf("storedInterfaceLanguage"),
  "app.js: explicit ?lang= must take precedence over stored language"
);
check(
  /<form method="dialog" class="dialog-close-form">[\s\S]*?id="closeAuthDialog"/.test(index),
  "index.html: account dialog close control needs a native dialog fallback"
);
for (const id of ["closeProfileDialog", "closeAuthDialog", "closeSimilarSongsDialog", "closeDialog"]) {
  check(index.includes(`id="${id}"`), `index.html: missing dialog close control #${id}`);
}
check(
  /dialog>\.dialog-close,[\s\S]*?dialog>\.dialog-close-form>\.dialog-close\{[\s\S]*?position:absolute;[\s\S]*?z-index:10;/.test(elegantUi),
  "elegant-ui.css: dialog close controls must stay above dialog content"
);
for (const semanticWrapper of [
  /<section[^>]+data-screen="profile-v2"/,
  /<section[^>]+class="stats screen-panel/,
  /<section[^>]+id="listenScreen"/
]) {
  check(!semanticWrapper.test(index), "index.html: view-only wrapper must not be an unlabelled section");
}
check(
  !/<h2>Have you heard this song before\?<\/h2>/.test(performance),
  "performance.js: rating UI bypasses localization"
);
check(
  performance.includes('routeFromLocation() === "listen" ? songFromLocation() : null'),
  "performance.js: active rating view is not preserved during catalog refresh"
);

const localAssets = [...index.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)]
  .map((match) => match[1])
  .filter((value) => !value.includes(":") && !value.startsWith("#"));
for (const asset of new Set(localAssets)) {
  check(existsSync(join(root, asset.replace(/^\.\//, ""))), `index.html: missing asset ${asset}`);
}

for (const file of ["admin.html", "changelog.html", "community-guidelines.html", "embed.html", "privacy.html", "rights.html", "terms.html"]) {
  const html = read(file);
  check(/<meta name="description"/i.test(html), `${file}: missing description`);
  check(/<link rel="canonical"/i.test(html), `${file}: missing canonical`);
  check(/<h1\b/i.test(html), `${file}: missing h1`);
}

const migrationFiles = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"));
const migrationVersions = migrationFiles.map((name) => name.split("_", 1)[0]);
const duplicateMigrationVersions = [...new Set(migrationVersions.filter((version, position) => migrationVersions.indexOf(version) !== position))];
check(duplicateMigrationVersions.length === 0, `migrations: duplicate versions: ${duplicateMigrationVersions.join(", ")}`);

const migrations = migrationFiles
  .map((name) => read(`supabase/migrations/${name}`))
  .join("\n");
for (const table of ["songs", "ratings", "recommendations", "song_seed_metrics", "playlists", "playlist_songs", "listening_history", "feedback_box", "tournament_runs", "tournament_votes"]) {
  check(new RegExp(`create table if not exists public\\.${table}\\b`, "i").test(migrations), `migrations: missing table ${table}`);
}
for (const rpc of ["get_hidden_gem_data_segment_v2", "get_genre_directory", "get_discovery_feeds", "record_song_open", "save_listener_profile"]) {
  check(new RegExp(`function public\\.${rpc}\\b`, "i").test(migrations), `migrations: missing RPC ${rpc}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("JHG smoke checks passed.");
