const form = document.querySelector("form");

form.onsubmit = (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  const identifier = [
    formData.get("room"),
    formData.get("wall"),
    formData.get("shelf"),
    formData.get("book"),
    formData.get("page"),
  ].join(".");
  location.href = `/ref/${identifier}`;
};

const room = form.querySelector('[name="room"]');
room.oninput = (e) => {
  if (
    (!e.data || !/[a-z0-9]/.test(e.data) || e.target.value.length === 3004) &&
    e.inputType !== "deleteContentBackward" &&
    e.inputType !== "deleteContentForward"
  ) {
    e.target.value = e.target.value.slice(0, -1);
  }
};

const constrainInput = (e) => {
  if (e.target.value === "") return;
  const min = parseInt(e.target.min);
  const max = parseInt(e.target.max);
  if (e.target.value < min) e.target.value = min;
  if (e.target.value > max) e.target.value = max;
};

const wall = form.querySelector('[name="wall"]');
wall.oninput = constrainInput;

const shelf = form.querySelector('[name="shelf"]');
shelf.oninput = constrainInput;

const book = form.querySelector('[name="book"]');
book.oninput = constrainInput;

const page = form.querySelector('[name="page"]');
page.oninput = constrainInput;
