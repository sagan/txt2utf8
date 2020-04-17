const fs = require("fs-extra");
const readdirp = require("readdirp");
const detectCharacterEncoding = require("detect-character-encoding");
const { convert } = require("encoding");
const { prompt } = require("enquirer");

async function main(argv) {
  if (argv.length == 0) {
    console.log(`Usage: txt2utf8 <root>`);
    return;
  }
  let root = argv[0];
  let count = 0;
  const { confirm } = await prompt({
    type: "input",
    name: "confirm",
    message: `Will convert all *.txt files in ${root} to UTF-8. Are you sure to continue ? (y/n)`
  });
  if (confirm != "y" && confirm != "Y") {
    console.log("Abort");
    return;
  }
  for await (const entry of readdirp(root, {
    alwaysStat: true,
    fileFilter: ["*.txt", "*.TXT", "*.Txt"]
  })) {
    const { path, fullPath, basename, stats } = entry;
    if (stats.size < 100) {
      // console.log(`skip small file ${path}`);
      continue;
    } else if (stats.size >= 100 * 1024 * 1024) {
      console.log(`skip big file ${path}`);
      continue;
    }
    const fileBuffer = await fs.readFile(fullPath);
    const { encoding, confidence } = detectCharacterEncoding(fileBuffer);
    if (!encoding || encoding == "UTF-8") {
      continue;
    }
    if (confidence != 100) {
      console.log(`Skip ${path} due to low confidence`);
      continue;
    }
    console.log(`convert ${path} from ${encoding} to utf8`);
    await fs.writeFile(fullPath, convert(fileBuffer, "UTF-8", encoding));
    count++;
  }
  console.log(`Done converted ${count} files to UTF-8`);
}

module.exports = { main };

if (require.main === module) {
  main(process.argv.slice(2));
}
