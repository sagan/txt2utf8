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
      "--min <min_size>",
      "only convert files of at least this size.",
      parseFloat,
      100
    )
    .option(
      "-t, --type <file_type>",
      "convert files of these comma seperated exension(s).",
      "txt"
    )
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
  let fileFilter = program.type.split(/\s*,\s*/).reduce((fileFilter, type) => {
    if (type.startsWith(".")) {
      type = type.slice(1);
    }
    if (!type) {
      return fileFilter;
    }
    type = type.toLowerCase();
    fileFilter.push(`*.${type}`);
    fileFilter.push(`*.${type.toUpperCase()}`);
    if (type.length > 1) {
      fileFilter.push(`*.${type[0].toUpperCase() + type.slice(1)}`);
    }
    return fileFilter;
  }, []);
  if (fileFilter.length == 0) {
    fileFilter.push("*.txt", "*.TXT", "*.Txt");
  }
  const { confirm } = await prompt({
    type: "input",
    name: "confirm",
    message: `Will convert all ${fileFilter.join(
      ","
    )} files (of at least size ${
      program.min
    }) in ${root} to UTF-8. Are you sure to continue ? (y/n)`
  });
  if (confirm != "y" && confirm != "Y") {
    console.log("Abort");
    return;
  }
  for await (const entry of readdirp(root, {
    alwaysStat: true,
    fileFilter
  })) {
    const { path: p, fullPath, basename, stats } = entry;
    if (stats.size < program.min) {
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
