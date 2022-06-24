import Koa from "koa";
import Router from "@koa/router";
import Pug from "koa-pug";
import serve from "koa-static";
import path from "path";
import memoize from "memoizee";
import { LINES, CHARS, uniquePages } from "./constants.js";
import {
  checkBounds,
  getPage,
  getSequentialPageNumberFromIdentifier,
  getIdentifierFromSequentialPageNumber,
  getRandomPageIdentifier,
} from "./babel.js";
import {
  searchEmptyPage,
  searchRandomChars,
  searchRandomWords,
} from "./search.js";

const getPageWithMeta = (identifier) => {
  const { info, lines } = getPage(identifier);

  const pageNumber = getSequentialPageNumberFromIdentifier(identifier);

  const prevPage = pageNumber.isGreaterThan(1)
    ? getIdentifierFromSequentialPageNumber(pageNumber.minus(1))
    : null;
  const nextPage = pageNumber.isLessThan(uniquePages.minus(1))
    ? getIdentifierFromSequentialPageNumber(pageNumber.plus(1))
    : null;

  return { info, lines, prevPage, nextPage };
};

const getPageWithMetaMemo = memoize(getPageWithMeta, {
  maxAge: 1000 * 60 * 30,
});

const app = new Koa();
const router = new Router();
const pug = new Pug({
  viewPath: path.resolve(path.resolve(), "src/views"),
  app,
});

app.use(serve("src/public"));

app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.get("X-Response-Time");
  console.log(`${ctx.method} ${ctx.url} - ${rt}`);
});

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set("X-Response-Time", `${ms}ms`);
});

router.get("/", async (ctx) => {
  await ctx.render("index");
});

router.get("/limitations", async (ctx) => {
  await ctx.render("limitations");
});

router.get("/faq", async (ctx) => {
  await ctx.render("faq");
});

router.get("/browse", async (ctx) => {
  await ctx.render("browse");
});

router
  .get("/ref/:identifier", async (ctx) => {
    const { identifier } = ctx.params;

    try {
      checkBounds(...identifier.split("."));
    } catch (e) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    const { info, lines, prevPage, nextPage } = getPageWithMetaMemo(identifier);

    await ctx.render("page", { info, lines, prevPage, nextPage });
  })
  .get("/search", async (ctx) => {
    const { content, mode } = ctx.request.query;

    if (!content || content.replace(/ /g, "") === "") {
      await ctx.render("search");
      return;
    }

    const lowerCase = content.toLowerCase();
    const contentNoNewlines = lowerCase.replace(/\r/g, "").replace(/\n/g, "");

    if (contentNoNewlines.length > LINES * CHARS) {
      ctx.status = 400;
      ctx.body = `Content cannot be longer than ${
        LINES * CHARS
      } characters long.`;
      return;
    }

    let reference;
    let highlightLocation;

    if (!mode || mode === "empty") {
      const { identifier } = searchEmptyPage(lowerCase);
      reference = identifier;
    } else if (mode === "chars") {
      const { identifier, highlight } = searchRandomChars(lowerCase);
      reference = identifier;
      highlightLocation = highlight;
    } else if (mode === "words") {
      const { identifier, highlight } = searchRandomWords(lowerCase);
      reference = identifier;
      highlightLocation = highlight;
    }

    let refUrl = `/ref/${reference}`;
    if (highlightLocation) {
      refUrl += `?highlight=${highlightLocation}`;
    }

    ctx.status = 302;
    ctx.redirect(refUrl);
  })
  .get("/random", (ctx) => {
    const randomIdentifier = getRandomPageIdentifier();

    ctx.status = 302;
    ctx.redirect(`/ref/${randomIdentifier}`);
  });

app.use(router.routes());
app.listen(5000);
console.log("listening on http://localhost:5000");
