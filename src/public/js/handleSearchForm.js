const form = document.querySelector("form");

form.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(form);

  const res = await fetch("/do-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: formData.get("content"),
      mode: formData.get("mode"),
    }),
  });

  if (res.ok) {
    const { ref, highlight } = await res.json();
    let url = `/ref/${ref}`;
    if (highlight) url += `?highlight=${highlight}`;
    location.href = url;
  }
};

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
