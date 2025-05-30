import { Level } from "level";
import { config } from "dotenv";
import { putKeyValue } from "../store";

(async () => {
  config();

  const db = new Level("./leveldb");

  const count = (await db.keys().all()).length;
  let i = 0;

  try {
    for await (const [key, value] of db.iterator()) {
      await putKeyValue(key, value);
      console.log(`${i} / ${count}`);
      i++;
    }
  } catch (err) {
    console.error(err);
  }
})();
