const [, identifier] = location.href.split("/ref/");
const [room, wall, shelf, book] = identifier.split(".");
const selector = document.querySelector(".PageNavigation select");
selector.onchange = (e) => {
  location.href = `/ref/${room}.${wall}.${shelf}.${book}.${e.target.value}`;
};
