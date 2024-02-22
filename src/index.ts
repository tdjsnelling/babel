import Koa from "koa";
import Router from "@koa/router";
import Pug from "koa-pug";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
import mongoose from "mongoose";
import { v4 as uuid, validate } from "uuid";
import dotenv from "dotenv";
import path from "path";
import { init as gmp_init } from "gmp-wasm";
import { WALLS, SHELVES, BOOKS, PAGES, LINES, CHARS } from "./constants";
import {
  initialiseNumbers,
  generateContent,
  lookupContent,
  getRandomIdentifier,
} from "./babel";
import {
  getEmptyBookContent,
  getEmptyPageBookContent,
  getRandomCharsBookContent,
  getRandomWordsBookContent,
} from "./search";
import Bookmark from "./schema/bookmark";

dotenv.config();

const getBookmark = async (roomOrUid: string) => {
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

const checkBounds = (
  wall: number,
  shelf: number,
  book: number,
  page: number
) => {
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
    await mongoose.connect(process.env.MONGO_URL as string);
  } catch (e: any) {
    console.error(`could not connect to database: ${e.message}`);
    setTimeout(connectToDatabase, 5000);
  }
};

(async () => {
  await connectToDatabase();

  const app = new Koa();
  const staticRouter = new Router();
  const dynamicRouter = new Router();

  new Pug({
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
    const bookmarkCount = await Bookmark.estimatedDocumentCount();
    await ctx.render("index", { bookmarkCount });
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
    const [roomOrUid, idWall, idShelf, idBook, idPage] = identifier.split(".");

    try {
      checkBounds(
        Number(idWall),
        Number(idShelf),
        Number(idBook),
        Number(idPage)
      );
    } catch (e: any) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    const bookmark = await getBookmark(roomOrUid);
    if (!bookmark) {
      throw new Error("That bookmark does not exist");
    }

    if (bookmark.uid !== roomOrUid) {
      ctx.status = 302;
      ctx.redirect(
        `/ref/${[bookmark.uid, idWall, idShelf, idBook, idPage].join(".")}`
      );
      return;
    }

    try {
      const { binding } = await gmp_init();
      const { C, N } = await initialiseNumbers(binding);
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
      } = await generateContent(
        binding,
        [bookmark.room, idWall, idShelf, idBook, idPage].join("."),
        C,
        N
      );
      await binding.reset();

      const [prevRoom, ...prevRest] = prevIdentifier.split(".");
      const prevBookmark = await getBookmark(prevRoom);
      if (!prevBookmark) {
        throw new Error("Prev bookmark does not exist");
      }

      const [nextRoom, ...nextRest] = nextIdentifier.split(".");
      const nextBookmark = await getBookmark(nextRoom);
      if (!nextBookmark) {
        throw new Error("Next bookmark does not exist");
      }

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
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  staticRouter.get("/fullref/:identifier", async (ctx) => {
    const { identifier } = ctx.params;
    const [roomOrUid, idWall, idShelf, idBook, idPage] = identifier.split(".");

    try {
      checkBounds(
        Number(idWall),
        Number(idShelf),
        Number(idBook),
        Number(idPage)
      );
    } catch (e: any) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    const bookmark = await getBookmark(roomOrUid);
    if (!bookmark) {
      throw new Error("That bookmark does not exist");
    }

    if (bookmark.uid !== roomOrUid) {
      ctx.status = 302;
      ctx.redirect(
        `/fullref/${[bookmark.uid, idWall, idShelf, idBook, idPage].join(".")}`
      );
      return;
    }

    try {
      const { binding } = await gmp_init();
      const { C, N } = await initialiseNumbers(binding);
      const { room, wall, shelf, book, page } = await generateContent(
        binding,
        [bookmark.room, idWall, idShelf, idBook, idPage].join("."),
        C,
        N
      );
      await binding.reset();

      ctx.body = `${room}.${wall}.${shelf}.${book}.${page}`;
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  dynamicRouter.use(async (ctx, next) => {
    ctx.set("Cache-Control", "no-cache, no-store");
    await next();
  });

  dynamicRouter.post("/get-uid", async (ctx) => {
    const { identifier } = ctx.request.body as { identifier: string };
    const [roomOrUid, ...rest] = identifier.split(".");

    try {
      const bookmark = await getBookmark(roomOrUid);
      if (!bookmark) {
        throw new Error("That bookmark does not exist");
      }
      ctx.body = [bookmark.uid, ...rest].join(".");
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  dynamicRouter.post("/do-search", async (ctx) => {
    const { content, mode } = ctx.request.body as {
      content: string;
      mode: string;
    };

    const lowerCase = content.toLowerCase();
    const contentNoNewlines = lowerCase.replace(/\r/g, "").replace(/\n/g, "");

    if (contentNoNewlines.length > PAGES * LINES * CHARS) {
      ctx.status = 400;
      ctx.body = `Content cannot be longer than ${
        PAGES * LINES * CHARS
      } characters long.`;
      return;
    }

    let book = "";
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
      page = Math.ceil(startLine / LINES);
      const newStartLine = startLine - (page - 1) * LINES;
      const newEndLine = endLine - (page - 1) * LINES;
      highlight = [newStartLine, startCol, newEndLine, endCol].join(":");
    }

    try {
      const { binding } = await gmp_init();
      const { I, N } = await initialiseNumbers(binding);
      const identifier = await lookupContent(binding, book, I, N, page);
      await binding.reset();

      const [room, ...rest] = identifier.split(".");
      const bookmark = await getBookmark(room);
      if (!bookmark) {
        throw new Error("That bookmark does not exist");
      }

      ctx.body = { ref: [bookmark.uid, ...rest].join("."), highlight };
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  dynamicRouter.get("/random", async (ctx) => {
    try {
      const { binding } = await gmp_init();
      const identifier = await getRandomIdentifier(binding);
      await binding.reset();

      const [room, ...rest] = identifier.split(".");
      const bookmark = await getBookmark(room);
      if (!bookmark) {
        throw new Error("That bookmark does not exist");
      }

      ctx.status = 302;
      ctx.redirect(`/ref/${[bookmark.uid, ...rest].join(".")}`);
    } catch (e: any) {
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
