import BigNumber from "bignumber.js";

export const ALPHA = "abcdefghijklmnopqrstuvwxyz., ";
export const WALLS = 4;
export const SHELVES = 5;
export const BOOKS = 32;
export const PAGES = 410;
export const LINES = 40;
export const CHARS = 80;

BigNumber.config({ RANGE: LINES * CHARS * 5 });

export const N = new BigNumber(
  Array(LINES * CHARS)
    .fill("s")
    .join(""),
  ALPHA.length
);

const gcd = (a, b) => {
  if (b.isZero()) return a;
  else return gcd(b, a.modulo(b));
};

const isCoprime = (a, b) => gcd(a, b).isEqualTo(1);

const egcd = (a, b) => {
  if (a < b) [a, b] = [b, a];
  let s = new BigNumber(0);
  let old_s = new BigNumber(1);
  let t = new BigNumber(1);
  let old_t = new BigNumber(0);
  let r = b;
  let old_r = a;
  while (!r.isZero()) {
    const q = old_r.dividedToIntegerBy(r);
    [r, old_r] = [old_r.minus(q.multipliedBy(r)), r];
    [s, old_s] = [old_s.minus(q.multipliedBy(s)), s];
    [t, old_t] = [old_t.minus(q.multipliedBy(t)), t];
  }
  console.log("Bezout coef: ", old_s.toString(), old_t.toString());
  console.log("GCD: ", old_r.toString());
  console.log("Quot by GCD: ", s.toString(), t.toString());
  return [old_r, old_t, old_s];
};

const modinv = (a, m) => {
  const [g, x, y] = egcd(a, m);
  if (!g.isEqualTo(1)) return null;
  return x.modulo(m);
};

const generateRandomComprimes = () => {
  let randomStarting = "s";
  while (randomStarting.length < LINES * CHARS) {
    randomStarting += Math.floor(Math.random() * ALPHA.length).toString(
      ALPHA.length
    );
  }

  console.log("start", randomStarting);

  let c = new BigNumber(randomStarting, ALPHA.length);
  while (1) {
    c = c.minus(1);
    const cp = isCoprime(N, c);
    if (cp) {
      console.log("found coprime...");
      const inv = modinv(N, c);
      if (inv) {
        console.log("coprime", c.toString(29), c.toString(29).length);
        console.log("modinv", inv.toString(29), inv.toString(29).length);
        break;
      }
      console.log("no modular inverse");
    }
  }
};

generateRandomComprimes();
