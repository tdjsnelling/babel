import Koa, { Request } from "koa";
import Router from "@koa/router";
import Pug from "koa-pug";
import serve from "koa-static";
import bodyParser from "koa-bodyparser";
// @ts-ignore
import formidable from "koa2-formidable";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { init as gmp_init } from "gmp-wasm";
import { createHash } from "crypto";
import { Level } from "level";
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
import { generatePdf } from "./pdf";

dotenv.config();

type FormidableRequest = Request & {
  files: {
    [key: string]: {
      path: string;
    };
  };
};

const memoCache: { [key: string]: { result?: any; expiry?: Date } } = {};
const memo = async (fn: () => any, validForMs: number) => {
  let memoResult = memoCache[fn.name];
  if (!memoResult || !memoResult.expiry || memoResult.expiry < new Date()) {
    memoResult = {};
    const result = await fn();
    memoResult.result = result;
    memoResult.expiry = new Date(Date.now() + validForMs);
    memoCache[fn.name] = memoResult;
    return result;
  }
  return memoResult.result;
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

(async () => {
  const db = new Level("./leveldb");

  const countBookmarks = async () => (await db.keys().all()).length;

  const app = new Koa();
  const staticRouter = new Router();
  const dynamicRouter = new Router();

  new Pug({
    viewPath: path.resolve(path.resolve(), "src/views"),
    app,
  });

  const getBookmark = async (
    roomOrHash: string
  ): Promise<{ hash: string; room: string | null }> => {
    let room;

    const isHash = roomOrHash.startsWith("@");

    if (isHash) {
      try {
        room = await db.get(roomOrHash);
      } catch (e) {
        room = null;
      }
      return { hash: roomOrHash, room };
    } else {
      room = roomOrHash;

      if (room.length > 1 && room.startsWith("0")) {
        room = room.replace(/^0+/, "");
      }

      const hash = "@" + createHash("sha256").update(room).digest("hex");

      try {
        room = await db.get(hash);
      } catch (e) {
        await db.put(hash, room);
      }

      return { hash, room };
    }
  };

  app.use(async (ctx, next) => {
    ctx.set("Cache-Control", "public, max-age=86400");
    await next();
  });

  app.use(serve("src/public"));

  app.use(
    formidable({
      maxFiles: 1,
      maxFileSize: 5 * 1024 * 1024,
    })
  );

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

  staticRouter.get("/", async (ctx) => {
    const bookmarkCount = await memo(countBookmarks, 1000 * 60 * 60);
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

  staticRouter.get("/story", async (ctx) => {
    await ctx.render("story");
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

    try {
      const bookmark = await getBookmark(roomOrUid);
      if (!bookmark.room) {
        throw new Error("That bookmark does not exist");
      }

      if (bookmark.hash !== roomOrUid) {
        ctx.status = 302;
        ctx.redirect(
          `/ref/${[bookmark.hash, idWall, idShelf, idBook, idPage].join(".")}`
        );
        return;
      }

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
        N,
        false
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
          uid: bookmark.hash,
          roomShort,
          room,
          wall,
          shelf,
          book,
          page,
        },
        lines: content.match(new RegExp(`.{${CHARS}}`, "g")),
        prevPage: [prevBookmark.hash, ...prevRest].join("."),
        nextPage: [nextBookmark.hash, ...nextRest].join("."),
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

    try {
      const bookmark = await getBookmark(roomOrUid);
      if (!bookmark) {
        throw new Error("That bookmark does not exist");
      }

      if (bookmark.hash !== roomOrUid) {
        ctx.status = 302;
        ctx.redirect(
          `/fullref/${[bookmark.hash, idWall, idShelf, idBook, idPage].join(
            "."
          )}`
        );
        return;
      }

      ctx.body = `${bookmark.room}.${idWall}.${idShelf}.${idBook}.${idPage}`;
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  staticRouter.get("/pdf/:identifier", async (ctx) => {
    const { identifier } = ctx.params;
    const [roomOrUid, idWall, idShelf, idBook] = identifier.split(".");

    try {
      checkBounds(Number(idWall), Number(idShelf), Number(idBook), Number(1));
    } catch (e: any) {
      ctx.status = 400;
      ctx.body = e.message;
      return;
    }

    const bookmark = await getBookmark(roomOrUid);
    if (!bookmark) {
      throw new Error("That bookmark does not exist");
    }

    if (bookmark.hash !== roomOrUid) {
      ctx.status = 302;
      ctx.redirect(
        `/pdf/${[bookmark.hash, idWall, idShelf, idBook].join(".")}`
      );
      return;
    }

    try {
      const { binding } = await gmp_init();
      const { C, N } = await initialiseNumbers(binding);
      const { content, roomShort, wall, shelf, book } = await generateContent(
        binding,
        [bookmark.room, idWall, idShelf, idBook].join("."),
        C,
        N,
        true
      );
      await binding.reset();

      ctx.set("Content-Type", "application/pdf");
      ctx.body = await generatePdf(
        content,
        roomShort,
        bookmark.hash,
        wall,
        shelf,
        book
      );
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  staticRouter.get("/bookmark/:identifier", async (ctx) => {
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
    if (!bookmark.room) {
      throw new Error("That bookmark does not exist");
    }

    if (bookmark.hash !== roomOrUid) {
      ctx.status = 302;
      ctx.redirect(
        `/bookmark/${[bookmark.hash, idWall, idShelf, idBook, idPage].join(
          "."
        )}`
      );
      return;
    }

    try {
      /*
        | page | page | book | shelf | wall | room ... |
      */
      const buf = Buffer.from([
        Math.min(255, Number(idPage)),
        Math.max(0, Number(idPage) - 255),
        Number(idBook),
        Number(idShelf),
        Number(idWall),
      ]);

      let roomBuf = Buffer.alloc(0);

      const { calculate } = await gmp_init();
      // @ts-ignore
      calculate((g) => {
        roomBuf = Buffer.from(
          g.Integer(bookmark.room as string, 32).toBuffer()
        );
      });

      ctx.set(
        "Content-Disposition",
        `attachment; filename="${identifier}.babel"`
      );
      ctx.body = Buffer.concat([buf, roomBuf]);
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
      ctx.body = [bookmark.hash, ...rest].join(".");
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

      ctx.body = { ref: [bookmark.hash, ...rest].join("."), highlight };
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
      ctx.redirect(`/ref/${[bookmark.hash, ...rest].join(".")}`);
    } catch (e: any) {
      ctx.status = 500;
      ctx.body = e.message;
    }
  });

  dynamicRouter.post("/open-bookmark", async (ctx) => {
    if (!(ctx.request as FormidableRequest).files?.bookmark) {
      ctx.status = 400;
      ctx.body = "Missing `bookmark` file";
      return;
    }

    try {
      const buf = fs.readFileSync(
        (ctx.request as FormidableRequest).files.bookmark.path
      );
      const [page1, page2, book, shelf, wall, ...room] = buf;
      const page = page1 + page2;

      let roomStr;

      const { calculate } = await gmp_init();
      // @ts-ignore
      calculate((g) => {
        roomStr = g.Integer(new Uint8Array(room), 32).toString(32);
      });

      if (!roomStr) {
        throw new Error("Could not parse room from bookmark");
      }

      const bookmark = await getBookmark(roomStr);

      ctx.body = [bookmark.hash, wall, shelf, book, page].join(".");
      ctx.status = 200;
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
