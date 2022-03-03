const ALPHA = "abcdefghijklmnopqrstuvwxyz., ";
const input = document.querySelector("textarea");
input.oninput = (e) => {
  if (e.data && !ALPHA.includes(e.data) && e.inputType === "insertText") {
    e.target.value = e.target.value.slice(0, -1);
  }
};
