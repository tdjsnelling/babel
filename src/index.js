import Koa from "koa";
import Router from "@koa/router";
import BigNumber from "bignumber.js";
import { c, i } from "./constants.js";

const app = new Koa();
const router = new Router();

export const ALPHA = "abcdefghijklmnopqrstuvwxyz., ";
export const WALLS = 4;
export const SHELVES = 5;
export const BOOKS = 32;
export const PAGES = 410;
export const LINES = 40;
export const CHARS = 80;

BigNumber.config({ RANGE: 1e4 });

export const N = new BigNumber(
  Array(LINES * CHARS)
    .fill("s")
    .join(""),
  ALPHA.length
);

const roomRegex = /[0-9a-z]+/;

const border = new Array(CHARS + 5).fill("=").join("");

const padNum = (num) => (num < 10 ? `0${num}` : `${num}`);

const checkBounds = (room, wall, shelf, book, page) => {
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

const getSequentialPageNumberFromIdentifier = (identifier) => {
  const [room, wall, shelf, book, page] = identifier.split(".");
  const intRoom = new BigNumber(room, 36);

  const pPages = parseInt(page);
  const pBooks = (book - 1) * PAGES;
  const pShelves = (shelf - 1) * BOOKS * PAGES;
  const pWalls = (wall - 1) * SHELVES * BOOKS * PAGES;
  const pRooms = intRoom.minus(1).multipliedBy(WALLS * SHELVES * BOOKS * PAGES);

  return pRooms.plus(pWalls + pShelves + pBooks + pPages);
};

const getIdentifierFromSequentialPageNumber = (pageNumber) => {
  let remaining = pageNumber;

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

  return [room, wall.plus(1), shelf.plus(1), book.plus(1), remaining].join(".");
};

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

const reverseLookupPage = (content) => {
  const hash = content
    .split("")
    .map((char) => ALPHA.indexOf(char).toString(ALPHA.length))
    .join("");

  const v = new BigNumber(hash, ALPHA.length);
  const inv = new BigNumber(i, ALPHA.length);
  const seqPage = v.multipliedBy(inv).modulo(N).toString();

  return seqPage;
};

const formatPage = (pageContent) => {
  const lines = pageContent.match(new RegExp(`.{${CHARS}}`, "g"));
  return lines.map((line, i) => `${padNum(i + 1)} | ${line}`).join("\n");
};

const getFormattedPage = (identifier) => {
  const [room, wall, shelf, book, page] = identifier.split(".");
  const info = `room: ${room}, wall: ${wall}, shelf: ${shelf}, book: ${book}, page: ${page}`;

  const pageContent = generatePage(identifier);
  const formattedPage = formatPage(pageContent);

  return `${info}\n\n${border}\n${formattedPage}\n${border}`;
};

router.get("/", (ctx) => {
  ctx.body = `Welcome to the Library of Babel.

Look up a page at /ref/ROOM.WALL.SHELF.BOOK.PAGE

Where:
  ROOM is any lowercase alphanumeric string [a-z0-9]+
  WALL is an integer 1-4
  SHELF is an integer 1-5
  BOOK is an integer 1-32
  PAGE is an integer 1-410
  
Or find a page containing some text at /search?content=SEARCH_TERM
  
https://sites.evergreen.edu/politicalshakespeares/wp-content/uploads/sites/226/2015/12/Borges-The-Library-of-Babel.pdf`;
});

router
  .get("/ref/:identifier", (ctx) => {
    const { identifier } = ctx.params;

    try {
      checkBounds(...identifier.split("."));
    } catch (e) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    ctx.set("Content-Type", "text/plain");
    ctx.status = 200;
    ctx.body = getFormattedPage(identifier);
  })
  .get("/search", (ctx) => {
    let { content } = ctx.request.query;

    if (content.length > LINES * CHARS) {
      ctx.status = 400;
      ctx.body = `Content cannot be longer than ${
        LINES * CHARS
      } characters long.`;
      return;
    }

    while (content.length < LINES * CHARS) content += " ";

    const page = reverseLookupPage(content.toLowerCase());

    const identifier = getIdentifierFromSequentialPageNumber(
      new BigNumber(page)
    );

    ctx.status = 302;
    ctx.redirect(`/ref/${identifier}`);
  });

app.use(router.routes());
app.listen(5000);
console.log("listening on http://localhost:5000");
