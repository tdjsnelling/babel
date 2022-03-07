import { ALPHA, CHARS, LINES } from "./constants.js";
import { reverseLookupPage } from "./babel.js";
import { words } from "popular-english-words";

const getHighlightPos = (start, length) => {
  const startLine = Math.floor(start / CHARS);
  const startCol = start % CHARS;

  const endPos = start + length;
  const endLine = Math.floor(endPos / CHARS);
  const endCol = endPos % CHARS;

  return [startLine, startCol, endLine, endCol].join(":");
};

export const searchEmptyPage = (content) => {
  let page = content
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

  while (page.length < LINES * CHARS) page += " ";

  const identifier = reverseLookupPage(page);

  return { identifier };
};

export const searchRandomChars = (content) => {
  const randomStartPosition =
    Math.floor(
      Math.random() * (LINES * CHARS - content.length + 1) + content.length
    ) - content.length;

  const noLineBreaks = content.replace(/\r/g, "").replace(/\n/g, "");

  let page = "";

  while (page.length < randomStartPosition) {
    page += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  page += noLineBreaks;
  while (page.length < LINES * CHARS) {
    page += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }

  const identifier = reverseLookupPage(page);
  const highlight = getHighlightPos(randomStartPosition, noLineBreaks.length);

  return { identifier, highlight };
};

export const searchRandomWords = (content) => {
  const popularWords = words.getMostPopular(3000);

  const randomStartPosition =
    Math.floor(
      Math.random() * (LINES * CHARS - content.length + 1) + content.length
    ) - content.length;

  const noLineBreaks = content.replace(/\r/g, "").replace(/\n/g, "");

  let page = "";

  while (page.length < randomStartPosition) {
    const viableWords = popularWords.filter(
      (w) => w.length <= randomStartPosition - page.length - 1
    );
    page += `${
      viableWords[Math.floor(Math.random() * viableWords.length)] || ""
    } `;
  }
  page += `${noLineBreaks} `;
  while (page.length < LINES * CHARS) {
    const viableWords = popularWords.filter(
      (w) => w.length <= LINES * CHARS - page.length - 1
    );
    page += `${
      viableWords[Math.floor(Math.random() * viableWords.length)] || ""
    } `;
  }

  while (page.length < LINES * CHARS) page += " ";

  const identifier = reverseLookupPage(page);
  const highlight = getHighlightPos(randomStartPosition, noLineBreaks.length);

  return { identifier, highlight };
};
