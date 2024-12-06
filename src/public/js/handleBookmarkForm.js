const bookmarkForm = document.querySelector("form#bookmark");
const bookmarkFileInput = document.querySelector(
  'form#bookmark input[type="file"]'
);
const bookmarkButton = document.querySelector("form#bookmark button");

let file;

bookmarkFileInput.addEventListener("change", (event) => {
  [file] = event.target.files;
  console.log(file);
});

bookmarkForm.onsubmit = async (e) => {
  e.preventDefault();
  const form = new FormData();
  form.append("bookmark", file);

  bookmarkButton.disabled = true;
  bookmarkButton.innerText = "Loading...";

  const res = await fetch("/open-bookmark", {
    method: "POST",
    body: form,
  });

  bookmarkButton.disabled = false;
  bookmarkButton.innerText = "Go";

  if (res.ok) {
    const ref = await res.text();
    location.href = `/ref/${ref}`;
  }
};
