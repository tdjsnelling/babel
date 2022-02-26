import Alea from "alea";
import { ArgumentParser } from "argparse";

const argParser = new ArgumentParser();
argParser.add_argument("-m", "--mode", { help: 'either "lookup" or "search"' });
argParser.add_argument("-i", "--identifier", {
  help: '"lookup" mode only: an identifier in the format HEX.WALL.SHELF.BOOK.PAGE e.g. 123abc.2.2.27.300',
});
argParser.add_argument("-s", "--string", {
  help: '"search" mode only: a string to search for',
});
const args = argParser.parse_args();

const ALPHA = "abcdefghijklmnopqrstuvwxyz., ";
const WALLS = 4;
const SHELVES = 5;
const BOOKS = 32;
const PAGES = 410;
const LINES = 40;
const CHARS = 80;

const hexRegex = /[0-9a-z]+/;

const border = new Array(CHARS + 5).fill("=").join("");

const padNum = (num) => (num < 10 ? `0${num}` : `${num}`);

const checkBounds = (hex, wall, shelf, book, page) => {
  if (!hexRegex.test(hex))
    throw new Error(
      `Hex identifier must only include digits 0-9 and lower case letters a-z`
    );

  if (isNaN(wall) || isNaN(shelf) || isNaN(book) || isNaN(page))
    throw new Error("Wall, book, shelf, page must all be integers");

  if (wall < 1 || wall > WALLS)
    throw new Error(`Wall must be between 1 and ${WALLS}`);
  if (shelf < 1 || shelf > SHELVES)
    throw new Error(`Shelf must be between 1 and ${SHELVES}`);
  if (book < 1 || book > BOOKS)
    throw new Error(`Book must be between 1 and ${BOOKS}`);
  if (page < 1 || page > PAGES)
    throw new Error(`Page must be between 1 and ${PAGES}`);
};

const formatPage = (lines) =>
  lines.map((line, i) => `${padNum(i + 1)} | ${line}`).join("\n");

const generatePage = (identifier = "") => {
  const [hex, wall, shelf, book, page] = identifier.split(".");
  checkBounds(hex, wall, shelf, book, page);

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

const lookup = (identifier) => {
  const [hex, wall, shelf, book, page] = identifier.split(".");
  console.log(
    `lookup ${identifier} > hex: ${hex}, wall: ${wall}, shelf: ${shelf} book: ${book}, page: ${page}`
  );

  const lines = generatePage(identifier);
  const pageContent = formatPage(lines);
  console.log(`${border}\n${pageContent}\n${border}`);
};

if (args.mode === "lookup") {
  lookup(args.identifier);
}
