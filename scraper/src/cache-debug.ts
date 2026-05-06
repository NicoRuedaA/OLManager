/** Debug: find cache key for a player */
import crypto from "crypto";
import fs from "fs";

const player = process.argv[2] ?? "Chrisberg";
const params = { action: "parse", page: player, prop: "wikitext|images", format: "json" };
const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
const key = crypto.createHash("md5").update(sorted).digest("hex").slice(0, 12);

console.log("Player:", player);
console.log("Cache key:", key);
console.log("Cache files matching:", fs.readdirSync(".cache").filter(f => f.startsWith(key)).length);

// Also search by file content
let found = 0;
for (const f of fs.readdirSync(".cache")) {
  try {
    const data = JSON.parse(fs.readFileSync(`.cache/${f}`, "utf-8"));
    if (data.parse?.pageid && data.parse?.wikitext) {
      const title = data.parse.title ?? data.parse.pageid;
      if (typeof title === "string" && title.toLowerCase() === player.toLowerCase()) {
        console.log(`Found in: ${f} (pageID: ${data.parse.pageid})`);
        found++;
      }
    }
  } catch {}
}
console.log("By content search:", found, "hits");
