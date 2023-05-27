import Koa from "koa";
import Router from "@koa/router";
import Pug from "koa-pug";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
import mongoose from "mongoose";
import { v4 as uuid, validate } from "uuid";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { spawnSync } from "node:child_process";
import { WALLS, SHELVES, BOOKS, PAGES, LINES, CHARS } from "./constants.js";
import {
  getEmptyBookContent,
  getRandomCharsBookContent,
  getRandomWordsBookContent,
} from "./search.js";
import Bookmark from "./schema/bookmark.js";

dotenv.config();

const runCoreTask = (cmd) => {
  const process = spawnSync("bash", ["-c", cmd]);
  console.log(process);
  return {
    stdout: process.stdout?.length ? process.stdout.toString() : undefined,
    stderr: process.stderr?.length ? process.stderr.toString() : undefined,
  };
};

const getBookmark = async (roomOrUid) => {
  const isUUID = validate(roomOrUid);
  if (isUUID) {
    return Bookmark.findOne({ uid: roomOrUid });
  } else {
    let room = roomOrUid;
    if (room.startsWith("0")) {
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

(async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const app = new Koa();
  const router = new Router();
  const pug = new Pug({
    viewPath: path.resolve(path.resolve(), "src/views"),
    app,
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

  router.post("/get-uid", async (ctx) => {
    const { identifier } = ctx.request.body;
    const [roomOrUid, ...rest] = identifier.split(".");
    const bookmark = await getBookmark(roomOrUid);
    ctx.body = [bookmark.uid, ...rest].join(".");
  });

  router.get("/ref/:identifier", async (ctx) => {
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

    const filename = `${Date.now()}`;
    fs.writeFileSync(filename, [bookmark.room, ...rest].join("."));

    const task = runCoreTask(
      `./src/core/bin/babel -f ${filename} -i > ${filename}-out`
    );

    fs.unlinkSync(filename);

    if (task.stderr) {
      ctx.status = 500;
      ctx.body = task.stderr;
      return;
    }

    const data = fs.readFileSync(`${filename}-out`, {
      encoding: "utf8",
      flag: "r",
    });

    const [
      content,
      shortRoom,
      room,
      wall,
      shelf,
      book,
      page,
      prevPage,
      nextPage,
    ] = data.split("/");

    fs.unlinkSync(`${filename}-out`);

    const [prevRoom, ...prevRest] = prevPage.split(".");
    const prevBookmark = await getBookmark(prevRoom);

    const [nextRoom, ...nextRest] = nextPage.split(".");
    const nextBookmark = await getBookmark(nextRoom);

    await ctx.render("page", {
      info: {
        identifier,
        uid: bookmark.uid,
        shortRoom,
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
  });

  router.get("/search", async (ctx) => {
    const { content, mode } = ctx.request.query;

    if (!content || content.replace(/ /g, "") === "") {
      await ctx.render("search");
      return;
    }

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

    if (!mode || mode === "empty") {
      book = getEmptyBookContent(lowerCase);
    } else if (mode === "chars") {
      ({ book, highlight } = getRandomCharsBookContent(lowerCase));
    } else if (mode === "words") {
      ({ book, highlight } = getRandomWordsBookContent(lowerCase));
    }

    const filename = `${Date.now()}`;
    fs.writeFileSync(filename, book);

    let pageFlag = "";
    if (highlight) {
      const { startLine, startCol, endLine, endCol } = highlight;
      const page = Math.ceil(parseInt(startLine) / LINES);
      pageFlag = `-n ${page}`;
      const newStartLine = startLine - (page - 1) * LINES;
      const newEndLine = endLine - (page - 1) * LINES;
      highlight = [newStartLine, startCol, newEndLine, endCol].join(":");
    }

    const task = runCoreTask(
      `./src/core/bin/babel ${pageFlag} -f ${filename} -c > ${filename}-out`
    );

    fs.unlinkSync(filename);

    if (task.stderr) {
      ctx.status = 500;
      ctx.body = task.stderr;
      return;
    }

    const data = fs.readFileSync(`${filename}-out`, {
      encoding: "utf8",
      flag: "r",
    });
    const [room, ...rest] = data.split(".");
    fs.unlinkSync(`${filename}-out`);
    const bookmark = await getBookmark(room);

    let refUrl = `/ref/${[bookmark.uid, ...rest].join(".")}`;

    if (highlight) {
      refUrl += `?highlight=${highlight}`;
    }

    ctx.status = 302;
    ctx.redirect(refUrl);
  });

  router.get("/random", async (ctx) => {
    const filename = `${Date.now()}`;

    const task = runCoreTask(`./src/core/bin/babel -r > ${filename}`);

    if (task.stderr) {
      ctx.status = 500;
      ctx.body = task.stderr;
      return;
    }

    const data = fs.readFileSync(filename, { encoding: "utf8", flag: "r" });
    const [room, ...rest] = data.split(".");
    fs.unlinkSync(filename);
    const bookmark = await getBookmark(room);

    ctx.status = 302;
    ctx.redirect(`/ref/${[bookmark.uid, ...rest].join(".")}`);
  });

  const port = process.env.PORT || 3000;
  app.use(router.routes());
  app.listen(port);
  console.log(`listening on http://localhost:${port}`);
})();
