import BigNumber from "bignumber.js";
import {
  ALPHA,
  WALLS,
  SHELVES,
  BOOKS,
  PAGES,
  CHARS,
  N,
  c,
  i,
} from "./constants.js";

BigNumber.config({ RANGE: 1e4 });

const roomRegex = /[0-9a-z]+/;

const padNum = (num) => (num < 10 ? `0${num}` : `${num}`);

// Check that all parts of an identifier are valid
export const checkBounds = (room, wall, shelf, book, page) => {
  if (!roomRegex.test(room))
    throw new Error(
      `Room identifier must only include digits 0-9 and lower case letters a-z`
    );

  if (isNaN(wall) || isNaN(shelf) || isNaN(book) || isNaN(page))
    throw new Error("Wall, book, shelf, page must all be integers");

  if (wall < 1 || wall > WALLS)
    throw new Error(`Wall must be between 1 and ${WALLS}. Got: ${wall}`);
  if (shelf < 1 || shelf > SHELVES)
    throw new Error(`Shelf must be between 1 and ${SHELVES}. Got: ${shelf}`);
  if (book < 1 || book > BOOKS)
    throw new Error(`Book must be between 1 and ${BOOKS}. Got: ${book}`);
  if (page < 1 || page > PAGES)
    throw new Error(`Page must be between 1 and ${PAGES}. Got: ${page}`);
};

// Transform an identifier to a page number
export const getSequentialPageNumberFromIdentifier = (identifier) => {
  const [room, wall, shelf, book, page] = identifier.split(".");
  const intRoom = new BigNumber(room, 36);

  const pPages = parseInt(page);
  const pBooks = (book - 1) * PAGES;
  const pShelves = (shelf - 1) * BOOKS * PAGES;
  const pWalls = (wall - 1) * SHELVES * BOOKS * PAGES;
  const pRooms = intRoom.minus(1).multipliedBy(WALLS * SHELVES * BOOKS * PAGES);

  return pRooms.plus(pWalls + pShelves + pBooks + pPages);
};

// Transform a page number to an identifier
export const getIdentifierFromSequentialPageNumber = (pageNumber) => {
  let remaining = pageNumber.minus(1);

  const room = remaining
    .dividedToIntegerBy(WALLS * SHELVES * BOOKS * PAGES)
    .plus(1)
    .toString(36);
  remaining = remaining.modulo(WALLS * SHELVES * BOOKS * PAGES);

  const wall = remaining.dividedToIntegerBy(SHELVES * BOOKS * PAGES);
  remaining = remaining.modulo(SHELVES * BOOKS * PAGES);

  const shelf = remaining.dividedToIntegerBy(BOOKS * PAGES);
  remaining = remaining.modulo(BOOKS * PAGES);

  const book = remaining.dividedToIntegerBy(PAGES);
  remaining = remaining.modulo(PAGES);

  return [
    room,
    wall.plus(1),
    shelf.plus(1),
    book.plus(1),
    remaining.plus(1),
  ].join(".");
};

// Take and identifier and return the resulting page contents
const generatePage = (identifier) => {
  const seqPage = new BigNumber(
    getSequentialPageNumberFromIdentifier(identifier)
  );

  let pageContent = "";

  const coprime = new BigNumber(c, ALPHA.length);

  const result = seqPage.multipliedBy(coprime).modulo(N);
  const hash = result.toString(ALPHA.length);

  for (const index of hash.split("")) {
    pageContent += ALPHA[parseInt(index, ALPHA.length)];
  }

  return pageContent;
};

// Take a page's contents and return the identifier of the page that contains it
export const reverseLookupPage = (content) => {
  const hash = content
    .split("")
    .map((char) => ALPHA.indexOf(char).toString(ALPHA.length))
    .join("");

  const v = new BigNumber(hash, ALPHA.length);
  const inv = new BigNumber(i, ALPHA.length);

  return getIdentifierFromSequentialPageNumber(v.multipliedBy(inv).modulo(N));
};

// Take an identifier and return a pretty-printed version of the page location + contents
export const getFormattedPage = (identifier) => {
  const [room, wall, shelf, book, page] = identifier.split(".");

  const pageContent = generatePage(identifier);

  const lines = pageContent.match(new RegExp(`.{${CHARS}}`, "g"));
  const formattedPage = lines
    .map((line, i) => `${padNum(i + 1)} ${line}`)
    .join("\n");

  return {
    info: {
      room,
      shortRoom:
        room.length > 16 ? `${room.slice(0, 8)}...${room.slice(-8)}` : room,
      wall,
      shelf,
      book,
      page,
      identifier: [room, wall, shelf, book, page].join("."),
    },
    formattedPage,
  };
};

export const getRandomPageIdentifier = () => {
  const maxRoom = new BigNumber("10e+4677")
    .dividedToIntegerBy(BOOKS * SHELVES * WALLS)
    .multipliedBy(Math.random());
  const rWall = Math.ceil(WALLS * Math.random());
  const rShelf = Math.ceil(SHELVES * Math.random());
  const rBook = Math.ceil(BOOKS * Math.random());
  const rPage = Math.ceil(PAGES * Math.random());

  return [maxRoom.toString(36), rWall, rShelf, rBook, rPage].join(".");
};
