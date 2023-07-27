import Koa from "koa";
import Router from "@koa/router";
import Pug from "koa-pug";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
import mongoose from "mongoose";
import { v4 as uuid, validate } from "uuid";
import dotenv from "dotenv";
import path from "path";
import bindings from "bindings";
import { WALLS, SHELVES, BOOKS, PAGES, LINES, CHARS } from "./constants.js";
import {
  getEmptyBookContent,
  getEmptyPageBookContent,
  getRandomCharsBookContent,
  getRandomWordsBookContent,
} from "./search.js";
import Bookmark from "./schema/bookmark.js";

dotenv.config();

const babel = bindings("babel");

const getBookmark = async (roomOrUid) => {
  const isUUID = validate(roomOrUid);
  if (isUUID) {
    return Bookmark.findOne({ uid: roomOrUid });
  } else {
    let room = roomOrUid;
    if (room.length > 1 && room.startsWith("0")) {
      room = room.replace(/^0+/, "");
    }
    const bookmark = await Bookmark.findOne({ room });
    if (bookmark) {
      return bookmark;
    } else {
      const uid = uuid();
      const bookmark = new Bookmark({ uid, room });
      await bookmark.save();
      return bookmark;
    }
  }
};

const checkBounds = (wall, shelf, book, page) => {
  if (isNaN(wall) || isNaN(shelf) || isNaN(book) || isNaN(page))
    throw new Error("Wall, book, shelf, page must all be integers");

  if (wall < 1 || wall > WALLS)
    throw new Error(`Wall must be between 1 and ${WALLS}. Got: ${wall}`);
  if (shelf < 1 || shelf > SHELVES)
    throw new Error(`Shelf must be between 1 and ${SHELVES}. Got: ${shelf}`);
  if (book < 1 || book > BOOKS)
    throw new Error(`Book must be between 1 and ${BOOKS}. Got: ${book}`);
  if (page < 1 || page > PAGES)
    throw new Error(`Page must be between 1 and ${PAGES}. Got: ${page}`);
};

const connectToDatabase = async () => {
  try {
    console.log("connecting to database");
    mongoose.connection.once("open", async () => {
      console.log("connected to database successfully");
    });
    mongoose.connection.once("disconnected", async () => {
      console.log("lost connection to database");
      setTimeout(connectToDatabase, 5000);
    });
    await mongoose.connect(process.env.MONGO_URL);
  } catch (e) {
    console.error(`could not connect to database: ${e.message}`);
    setTimeout(connectToDatabase, 5000);
  }
};

(async () => {
  await connectToDatabase();

  const app = new Koa();
  const staticRouter = new Router();
  const dynamicRouter = new Router();
  const pug = new Pug({
    viewPath: path.resolve(path.resolve(), "src/views"),
    app,
  });

  app.use(async (ctx, next) => {
    ctx.set("Cache-Control", "public, max-age=15552000");
    await next();
  });

  app.use(serve("src/public"));

  app.use(
    bodyParser({
      jsonLimit: "3mb",
    })
  );

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

  staticRouter.use(async (ctx, next) => {
    ctx.set("Cache-Control", "public, max-age=86400");
    await next();
  });

  staticRouter.get("/", async (ctx) => {
    await ctx.render("index");
  });

  staticRouter.get("/about", async (ctx) => {
    await ctx.render("about");
  });

  staticRouter.get("/browse", async (ctx) => {
    await ctx.render("browse");
  });

  staticRouter.get("/search", async (ctx) => {
    await ctx.render("search");
  });

  staticRouter.get("/ref/:identifier", async (ctx) => {
    const { identifier } = ctx.params;
    const [roomOrUid, ...rest] = identifier.split(".");

    try {
      checkBounds(...rest);
    } catch (e) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    const bookmark = await getBookmark(roomOrUid);
    if (bookmark.uid !== roomOrUid) {
      ctx.status = 302;
      ctx.redirect(`/ref/${[bookmark.uid, ...rest].join(".")}`);
      return;
    }

    try {
      const {
        content,
        roomShort,
        room,
        wall,
        shelf,
        book,
        page,
        prevIdentifier,
        nextIdentifier,
      } = babel.getPage([bookmark.room, ...rest].join("."));

      const [prevRoom, ...prevRest] = prevIdentifier.split(".");
      const prevBookmark = await getBookmark(prevRoom);

      const [nextRoom, ...nextRest] = nextIdentifier.split(".");
      const nextBookmark = await getBookmark(nextRoom);

      await ctx.render("page", {
        info: {
          identifier,
          uid: bookmark.uid,
          roomShort,
          room,
          wall,
          shelf,
          book,
          page,
        },
        lines: content.match(new RegExp(`.{${CHARS}}`, "g")),
        prevPage: [prevBookmark.uid, ...prevRest].join("."),
        nextPage: [nextBookmark.uid, ...nextRest].join("."),
      });
    } catch (e) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  staticRouter.get("/fullref/:identifier", async (ctx) => {
    const { identifier } = ctx.params;
    const [roomOrUid, ...rest] = identifier.split(".");

    try {
      checkBounds(...rest);
    } catch (e) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    const bookmark = await getBookmark(roomOrUid);
    if (bookmark.uid !== roomOrUid) {
      ctx.status = 302;
      ctx.redirect(`/fullref/${[bookmark.uid, ...rest].join(".")}`);
      return;
    }

    try {
      const { room, wall, shelf, book, page } = babel.getPage(
        [bookmark.room, ...rest].join(".")
      );

      ctx.body = `${room}.${wall}.${shelf}.${book}.${page}`;
    } catch (e) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  dynamicRouter.use(async (ctx, next) => {
    ctx.set("Cache-Control", "no-cache, no-store");
    await next();
  });

  dynamicRouter.post("/get-uid", async (ctx) => {
    const { identifier } = ctx.request.body;
    const [roomOrUid, ...rest] = identifier.split(".");
    const bookmark = await getBookmark(roomOrUid);
    ctx.body = [bookmark.uid, ...rest].join(".");
  });

  dynamicRouter.post("/do-search", async (ctx) => {
    const { content, mode } = ctx.request.body;

    const lowerCase = content.toLowerCase();
    const contentNoNewlines = lowerCase.replace(/\r/g, "").replace(/\n/g, "");

    if (contentNoNewlines.length > PAGES * LINES * CHARS) {
      ctx.status = 400;
      ctx.body = `Content cannot be longer than ${
        PAGES * LINES * CHARS
      } characters long.`;
      return;
    }

    let book;
    let highlight;
    let page = 1;

    if (!mode || mode === "empty") {
      ({ book, page } = getEmptyPageBookContent(lowerCase));
    } else if (mode === "emptybook") {
      book = getEmptyBookContent(lowerCase);
    } else if (mode === "chars") {
      ({ book, highlight } = getRandomCharsBookContent(lowerCase));
    } else if (mode === "words") {
      ({ book, highlight } = getRandomWordsBookContent(lowerCase));
    }

    if (highlight) {
      const { startLine, startCol, endLine, endCol } = highlight;
      page = Math.ceil(parseInt(startLine) / LINES);
      const newStartLine = startLine - (page - 1) * LINES;
      const newEndLine = endLine - (page - 1) * LINES;
      highlight = [newStartLine, startCol, newEndLine, endCol].join(":");
    }

    try {
      const identifier = babel.searchContent(book, page);

      const [room, ...rest] = identifier.split(".");
      const bookmark = await getBookmark(room);

      ctx.body = { ref: [bookmark.uid, ...rest].join("."), highlight };
    } catch (e) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  dynamicRouter.get("/random", async (ctx) => {
    try {
      const identifier = babel.getRandomIdentifier();
      const [room, ...rest] = identifier.split(".");
      const bookmark = await getBookmark(room);

      ctx.status = 302;
      ctx.redirect(`/ref/${[bookmark.uid, ...rest].join(".")}`);
    } catch (e) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  const port = process.env.PORT || 3000;
  app.use(staticRouter.routes());
  app.use(dynamicRouter.routes());
  app.listen(port);
  console.log(`listening on http://localhost:${port}`);
})();
