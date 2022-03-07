const url = new URL(location.href);
const toHighlight = url.searchParams.get("highlight");

if (toHighlight) {
  let [startLine, startCol, endLine, endCol] = toHighlight.split(":");

  startLine = parseInt(startLine);
  startCol = parseInt(startCol);
  endLine = parseInt(endLine);
  endCol = parseInt(endCol);

  const content = document.querySelector(".PageContent pre");
  const lines = content.innerText.split("\n");

  const startingLine = lines[startLine].split("");
  startingLine.splice(startCol, 0, "<strong>");
  lines[startLine] = startingLine.join("");

  const endingLink = lines[endLine].split("");
  endingLink.splice(endCol + (startLine === endLine ? 8 : 0), 0, "</strong>");
  lines[endLine] = endingLink.join("");

  content.innerHTML = lines.join("\n");
}
