const ALPHA = "abcdefghijklmnopqrstuvwxyz., ";
const input = document.querySelector("textarea");
input.oninput = (e) => {
  if (e.inputType === "insertFromPaste") {
    const content = e.target.value
      .toLowerCase()
      .split("")
      .map((char) => {
        if (!ALPHA.includes(char) && char !== "\r" && char !== "\n") return "";
        return char;
      })
      .join("");
    e.target.value = content;
  } else if (
    e.data &&
    !ALPHA.includes(e.data.toLowerCase()) &&
    e.inputType === "insertText"
  ) {
    e.target.value = e.target.value.slice(0, -1);
  }
};
