import fs from "node:fs";
const manifest=JSON.parse(fs.readFileSync("manifest.json","utf8"));
const [major,minor,patch]=manifest.version.split(".").map(Number);
manifest.version=[major,minor,patch+1].join(".");
fs.writeFileSync("manifest.json",JSON.stringify(manifest,null,2)+"\n");
const versions=JSON.parse(fs.readFileSync("versions.json","utf8"));
versions[manifest.version]=manifest.minAppVersion;
fs.writeFileSync("versions.json",JSON.stringify(versions,null,2)+"\n");
