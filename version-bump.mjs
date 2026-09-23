import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const versionParts = manifest.version.split(".").map(Number);
if (versionParts.length !== 3 || versionParts.some(part => !Number.isInteger(part) || part < 0)) {
  throw new Error("manifest.json must use semantic version format x.y.z.");
}
versionParts[2] += 1;
manifest.version = versionParts.join(".");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
packageJson.version = manifest.version;
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
lock.version = manifest.version;
lock.packages[""].version = manifest.version;
const versions = JSON.parse(fs.readFileSync("versions.json", "utf8"));
versions[manifest.version] = manifest.minAppVersion;

fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
fs.writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
fs.writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
