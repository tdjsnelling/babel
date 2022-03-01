import Koa from "koa";
import Router from "@koa/router";
import { welcomeMessage, LINES, CHARS } from "./constants.js";
import { checkBounds, getFormattedPage, reverseLookupPage } from "./babel.js";

const app = new Koa();
const router = new Router();

router.get("/", (ctx) => {
  ctx.body = welcomeMessage;
});

router
  .get("/ref/:identifier", (ctx) => {
    const { identifier } = ctx.params;

    try {
      checkBounds(...identifier.split("."));
    } catch (e) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    ctx.set("Content-Type", "text/plain");
    ctx.status = 200;
    ctx.body = getFormattedPage(identifier);
  })
  .get("/search", (ctx) => {
    let { content } = ctx.request.query;

    if (content.length > LINES * CHARS) {
      ctx.status = 400;
      ctx.body = `Content cannot be longer than ${
        LINES * CHARS
      } characters long.`;
      return;
    }

    while (content.length < LINES * CHARS) content += " ";

    const identifier = reverseLookupPage(content.toLowerCase());

    ctx.status = 302;
    ctx.redirect(`/ref/${identifier}`);
  });

app.use(router.routes());
app.listen(5000);
console.log("listening on http://localhost:5000");
