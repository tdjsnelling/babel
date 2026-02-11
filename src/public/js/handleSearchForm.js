const form = document.querySelector("form");
const button = document.querySelector("form button");

form.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(form);

  button.disabled = true;
  button.innerText = "Loading...";

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

  button.disabled = false;
  button.innerText = "Search";

  if (res.ok) {
    const { ref, highlight } = await res.json();
    let url = `/ref/${ref}`;
    if (highlight) url += `?highlight=${highlight}`;
    location.href = url;
  }
};

const input = document.querySelector("textarea");
input.oninput = (e) => {
  const { value, selectionEnd } = e.currentTarget;
  const sanitizedValue = value
    .toLowerCase()
    .replaceAll(/[^a-z.,!?\- \r\n]/g, "");
  e.currentTarget.value = sanitizedValue;
  const deltaLength = value.length - sanitizedValue.length;
  if (deltaLength !== 0) {
    const caretPosition = Math.max(
      0,
      Math.min(sanitizedValue.length, selectionEnd - deltaLength)
    );
    e.currentTarget.selectionStart = e.currentTarget.selectionEnd =
      caretPosition;
  }
};
