// @ts-ignore
import { words } from "popular-english-words";
import fs from "fs";

const all = words.getMostPopular(10000);

fs.writeFileSync("./words.txt", all.join("\n"));
