const CHARS = 80;

const getHighlightPos = (start, length) => {
  const startLine = Math.floor(start / CHARS);
  const startCol = start % CHARS;

  const endPos = start + (length - 1);
  let endLine = Math.floor(endPos / CHARS);
  let endCol = endPos % CHARS;

  return `${startLine}:${startCol}:${endLine}:${endCol}`;
};

window.highlightWords = async () => {
  const res = await fetch("/words.txt");

  if (!res.ok) {
    console.error(`could not fetch words: ${res.status} ${res.statusText}`);
    return;
  }

  const contentEl = document.querySelector(".PageContent pre");

  const existingHighlights = contentEl.querySelectorAll(".Highlight");
  for (const el of existingHighlights) {
    el.remove();
  }

  const file = await res.text();
  const words = file.split("\n");

  const content = contentEl.innerText.replaceAll("\n", "");

  let params = [];

  for (const word of words) {
    const trimmed = word.trim();

    if (trimmed.length > 1) {
      const matches = content.matchAll(
        new RegExp(trimmed.length > 3 ? trimmed : `\\s${trimmed}\\s`, "g")
      );
      for (const match of matches) {
        const { 0: fullMatch, index } = match;
        if (trimmed) params.push([index, trimmed, fullMatch]);
      }
    }
  }

  for (const i in params) {
    const [index, word, fullMatch] = params[i];

    const fullMatchNoStartingWhitespace = fullMatch.trimStart();
    const startingSpaces =
      fullMatch.length - fullMatchNoStartingWhitespace.length;

    const highlight = getHighlightPos(index + startingSpaces, word.length);
    const [startRow, startCol, endRow, endCol] = highlight.split(":");

    const rowHeight = 14 * 1.2;

    const highlightEl = document.createElement("div");
    highlightEl.dataset.word = word;
    highlightEl.className = "Highlight";
    highlightEl.style.animationDelay = `${10 * Number(i)}ms`;
    highlightEl.style.top = `${Number(startRow) * rowHeight}px`;
    highlightEl.style.left = `${Number(startCol)}ch`;

    if (startRow === endRow) {
      highlightEl.style.width = `${Number(endCol) - Number(startCol) + 1}ch`;
    } else {
      highlightEl.style.width = `${CHARS - Number(startCol)}ch`;
      highlightEl.style.borderRightWidth = "0px";
      highlightEl.style.borderRadius = "2px 0 0 2px";

      const wrappedEl = highlightEl.cloneNode();
      highlightEl.style.top = `${Number(endRow) * rowHeight}px`;
      highlightEl.style.left = "0px";
      highlightEl.style.width = `${Number(endCol) + 1}ch`;
      highlightEl.style.borderLeftWidth = "0px";
      highlightEl.style.borderRightWidth = "1px";
      highlightEl.style.borderRadius = "0 2px 2px 0";
      contentEl.appendChild(wrappedEl);
    }

    contentEl.appendChild(highlightEl);
  }
};
