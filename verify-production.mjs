import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const expectedPackage = "com.sarfen1.strikeneon";
const expectedFingerprint = "6C:48:D5:49:CE:44:0E:88:9A:4D:70:12:20:63:C4:39:05:FB:6A:9D:9A:C6:43:5F:76:DE:53:14:81:29:C8:CD";
const required = [
  ".well-known/assetlinks.json",
  "manifest.webmanifest",
  "app-ads.txt",
  "index.html",
];

for (const relative of required) {
  const file = path.join(dist, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    console.error(`ERRO: ficheiro obrigatório ausente em dist/: ${relative}`);
    process.exitCode = 1;
  }
}
if (process.exitCode) process.exit(1);

const links = JSON.parse(fs.readFileSync(path.join(dist, ".well-known/assetlinks.json"), "utf8"));
const validLink = Array.isArray(links) && links.some((entry) =>
  entry?.target?.namespace === "android_app" &&
  entry?.target?.package_name === expectedPackage &&
  entry?.target?.sha256_cert_fingerprints?.includes(expectedFingerprint),
);
if (!validLink) throw new Error("assetlinks.json não contém package/fingerprint oficiais.");

const manifest = JSON.parse(fs.readFileSync(path.join(dist, "manifest.webmanifest"), "utf8"));
if (manifest.display !== "standalone" || manifest.start_url !== "/" || manifest.scope !== "/") {
  throw new Error("Manifest PWA não corresponde a standalone/start_url/scope esperados.");
}

const allFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else allFiles.push(full);
  }
}
walk(dist);
for (const file of allFiles) {
  if (!/\.(?:html|js|json|css|webmanifest|txt)$/i.test(file)) continue;
  const content = fs.readFileSync(file, "utf8");
  const legacyAndroidPackage = ["com", "sarfen1", "strikeneon2026"].join(".");
  if (content.includes(legacyAndroidPackage)) {
    throw new Error(`Identificador Android antigo encontrado em ${path.relative(dist, file)}`);
  }
}
console.log("OK: produção contém assetlinks.json, manifest standalone, app-ads.txt e package/fingerprint oficiais.");
console.log(`Ficheiros em dist/: ${allFiles.length}`);
