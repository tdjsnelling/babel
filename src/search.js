import { ALPHA, CHARS, LINES, PAGES } from "./constants.js";
import { words } from "popular-english-words";

const getHighlightPos = (start, length) => {
  const startLine = Math.floor(start / CHARS);
  const startCol = start % CHARS;

  const endPos = start + length;
  const endLine = Math.floor(endPos / CHARS);
  const endCol = endPos % CHARS;

  return { startLine, startCol, endLine, endCol };
};

export const getEmptyBookContent = (content) => {
  let book = content
    .split("\n")
    .map((line) => {
      let chars = line.split("");
      chars.forEach((char, i) => {
        if (!ALPHA.includes(char)) chars[i] = " ";
      });
      if (chars.length < CHARS) {
        chars = chars.concat(Array(CHARS - line.length).fill(" "));
      }
      return chars.join("");
    })
    .join("");

  while (book.length < PAGES * LINES * CHARS) book += " ";

  return book;
};

export const getRandomCharsBookContent = (content) => {
  const randomStartPosition =
    Math.floor(
      Math.random() * (PAGES * LINES * CHARS - content.length + 1) +
        content.length
    ) - content.length;

  const noLineBreaks = content.replace(/\r/g, "").replace(/\n/g, "");

  let book = "";

  while (book.length < randomStartPosition) {
    book += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  book += noLineBreaks;
  while (book.length < PAGES * LINES * CHARS) {
    book += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }

  const highlight = getHighlightPos(randomStartPosition, noLineBreaks.length);

  return { book, highlight };
};

export const getRandomWordsBookContent = (content) => {
  const popularWords = words.getMostPopular(3000);

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
