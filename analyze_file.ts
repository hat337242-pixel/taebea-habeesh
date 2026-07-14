import * as fs from "fs";
import * as path from "path";

function analyze() {
  const filePath = path.join(process.cwd(), "6037634802044833187.png");
  if (!fs.existsSync(filePath)) {
    console.log("File does not exist");
    return;
  }
  const buffer = fs.readFileSync(filePath);
  console.log("Size:", buffer.length);
  console.log("Hex (first 100 bytes):", buffer.slice(0, 100).toString("hex"));
  console.log("ASCII (first 100 bytes):", buffer.slice(0, 100).toString("ascii"));
}

analyze();
