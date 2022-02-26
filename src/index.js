import Alea from "alea";
import { ArgumentParser } from "argparse";

const argParser = new ArgumentParser();
argParser.add_argument("-m", "--mode");
argParser.add_argument("-i", "--identifier");
argParser.add_argument("-s", "--string");
const args = argParser.parse_args();

const ALPHA = "abcdefghijklmnopqrstuvwxyz., ";
const WALLS = 4;
const SHELVES = 5;
const BOOKS = 32;
const PAGES = 410;
const LINES = 40;
const CHARS = 80;

const border = new Array(CHARS + 5).fill("=").join("");

const padNum = (num) => (num < 10 ? `0${num}` : `${num}`);

const checkBounds = (wall, shelf, book, page) => {
  if (wall > WALLS) throw new Error(`Wall cannot be greater than ${WALLS}`);
  if (shelf > SHELVES)
    throw new Error(`Shelf cannot be greater than ${SHELVES}`);
  if (book > BOOKS) throw new Error(`Book cannot be greater than ${BOOKS}`);
  if (page > PAGES) throw new Error(`Page cannot be greater than ${PAGES}`);
};

const generatePage = (identifier = "") => {
  const [hex, wall, shelf, book, page] = identifier.split(".");
  checkBounds(wall, shelf, book, page);
  console.log(
    `lookup ${identifier} > hex: ${hex}, wall: ${wall}, shelf: ${shelf} book: ${book}, page: ${page}`
  );

  let lines = [];
  const linePrng = new Alea(identifier);

  for (let i = 0; i < LINES; i++) {
    lines[i] = "";
    const lineValue = linePrng();
    const charPrng = new Alea(lineValue);

    for (let j = 0; j < CHARS; j++) {
      const charValue = Number(charPrng().toString().replace("0.", ""));
      const char = ALPHA[Math.floor(charValue % ALPHA.length)];
      lines[i] += char;
    }
  }

  return lines;
};

if (args.mode === "lookup") {
  const lines = generatePage(args.identifier);
  const page = lines.map((line, i) => `${padNum(i + 1)} | ${line}`).join("\n");
  console.log(`${border}\n${page}\n${border}`);
}
