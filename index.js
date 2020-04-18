const fs = require("fs-extra");
const readdirp = require("readdirp");
const path = require("path");
const detectCharacterEncoding = require("detect-character-encoding");
const { program } = require("commander");
const { convert } = require("encoding");
const { prompt } = require("enquirer");
const { version } = require("./package.json");

async function main(argv) {
  let root;
  program
    .version(version)
    .arguments("<rootPath>")
    .option("-d, --debug", "output extra debugging")
    .option(
      "-r, --rename-unrecognized",
      "rename files which encoding is unrecognized with prefix '__unknown_encoding__'"
    )
    .action(function (rootPath) {
      root = rootPath;
    });
  program.parse(argv);
  if (program.debug) console.log(program.opts());

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
    const { path: p, fullPath, basename, stats } = entry;
    if (stats.size < 100) {
      // console.log(`skip small file ${p}`);
      continue;
    } else if (stats.size >= 100 * 1024 * 1024) {
      console.log(`skip big file ${p}`);
      continue;
    }
    const fileBuffer = await fs.readFile(fullPath);
    const { encoding, confidence } = detectCharacterEncoding(fileBuffer);
    if (!encoding || encoding == "UTF-8") {
      continue;
    }
    if (confidence != 100) {
      if (program.renameUnrecognized) {
        console.log(`Rename ${p} due to low confidence.`);
        try {
          await fs.rename(
            fullPath,
            path.join(path.dirname(fullPath), "__unknown_encoding__" + basename)
          );
        } catch (e) {}
      } else {
        console.log(`Skip ${p} due to low confidence`);
      }
      continue;
    }
    console.log(`convert ${p} from ${encoding} to utf8`);
    await fs.writeFile(fullPath, convert(fileBuffer, "UTF-8", encoding));
    count++;
  }
  console.log(`Done converted ${count} files to UTF-8`);
}

module.exports = { main };

if (require.main === module) {
  main(process.argv);
}
