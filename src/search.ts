// @ts-ignore
import { words } from "popular-english-words";
import { ALPHA, CHARS, LINES, PAGES } from "./constants";

// Precompute for fast membership checks
const allowed = new Set(ALPHA);

const getHighlightPos = (start: number, length: number) => {
  const startLine = Math.floor(start / CHARS);
  const startCol = start % CHARS;

  const endPos = start + length;
  const endLine = Math.floor(endPos / CHARS);
  const endCol = endPos % CHARS;

  return { startLine, startCol, endLine, endCol };
};

export const getEmptyBookContent = (content: string) => {
  const lines = content.slice(0, LINES * CHARS).split("\n");

  let page = "";
  for (let li = 0; li < LINES; li++) {
    const line = lines[li] ?? "";
    let out = "";
    for (let i = 0; i < CHARS; i++) {
      const c = line[i] ?? " ";
      out += allowed.has(c) ? c : " ";
    }
    page += out;
  }

  const bookArr = new Array(PAGES * LINES * CHARS).fill(" ");

  for (let i = 0; i < page.length; i++) {
    bookArr[i] = page[i];
  }

  return bookArr.join("");
};

const randAlphaChar = () => ALPHA[(Math.random() * ALPHA.length) | 0];

export const getEmptyPageBookContent = (content: string) => {
  const randomPage = Math.floor(Math.random() * PAGES);
  const startChar = randomPage * LINES * CHARS;

  const lines = content.slice(0, LINES * CHARS).split("\n");

  let page = "";
  for (let li = 0; li < LINES; li++) {
    const line = lines[li] ?? "";
    let out = "";
    for (let i = 0; i < CHARS; i++) {
      const c = line[i] ?? " ";
      out += allowed.has(c) ? c : " ";
    }
    page += out;
  }

  const bookArr = new Array(PAGES * LINES * CHARS);

  for (let i = 0; i < PAGES * LINES * CHARS; i++) bookArr[i] = randAlphaChar();

  for (let i = 0; i < page.length; i++) bookArr[startChar + i] = page[i];

  const book = bookArr.join("");

  return { book, page: randomPage + 1 };
};

export const getRandomCharsBookContent = (content: string) => {
  const randomStartPosition =
    Math.floor(
      Math.random() * (PAGES * LINES * CHARS - content.length + 1) +
        content.length
    ) - content.length;

  const noLineBreaks = content.replace(/\r/g, "").replace(/\n/g, "");

  const bookArr = new Array(PAGES * LINES * CHARS);

  for (let i = 0; i < PAGES * LINES * CHARS; i++) bookArr[i] = randAlphaChar();

  for (let i = 0; i < noLineBreaks.length; i++) {
    bookArr[randomStartPosition + i] = noLineBreaks[i];
  }

  const book = bookArr.join("");

  const highlight = getHighlightPos(randomStartPosition, noLineBreaks.length);

  return { book, highlight };
};

export const getRandomWordsBookContent = (content: string) => {
  const popularWords = words.getMostPopular(5000) as string[];

  const randomStartPosition =
    Math.floor(
      Math.random() * (PAGES * LINES * CHARS - content.length + 1) +
        content.length
    ) - content.length;

  const noLineBreaks = content.replace(/\r/g, "").replace(/\n/g, "");

  let book = "";

  while (book.length < randomStartPosition) {
    const viableWords = popularWords.filter(
      (w) => w.length <= randomStartPosition - book.length - 1
    );
    book += `${
      viableWords[Math.floor(Math.random() * viableWords.length)] || ""
    } `;
  }
  book += `${noLineBreaks} `;
  while (book.length < PAGES * LINES * CHARS) {
    const viableWords = popularWords.filter(
      (w) => w.length <= PAGES * LINES * CHARS - book.length - 1
    );
    book += `${
      viableWords[Math.floor(Math.random() * viableWords.length)] || ""
    } `;
  }

  while (book.length < PAGES * LINES * CHARS) book += " ";

  const highlight = getHighlightPos(randomStartPosition, noLineBreaks.length);

  return { book, highlight };
};
