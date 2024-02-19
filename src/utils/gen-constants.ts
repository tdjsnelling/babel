import fs from "fs";
import { init as gmp_init, GMPFunctions, mpz_ptr } from "gmp-wasm";
import { ALPHA, BOOK_LENGTH, BASE32_ALPHA, BASE32_LAST } from "../constants";

async function isCoprime(binding: GMPFunctions, a: mpz_ptr, b: mpz_ptr) {
  const gcd = binding.mpz_t();
  binding.mpz_init(gcd);
  binding.mpz_gcd(gcd, a, b);

  return binding.mpz_cmp_ui(gcd, 1) === 0;
}

async function findModularInverse(
  binding: GMPFunctions,
  num: mpz_ptr,
  mod: mpz_ptr
) {
  const gcd = binding.mpz_t();
  binding.mpz_init(gcd);

  const x = binding.mpz_t();
  binding.mpz_init(x);

  const y = binding.mpz_t();
  binding.mpz_init(y);

  binding.mpz_gcdext(gcd, x, y, num, mod);

  const inverseExists = binding.mpz_cmp_ui(gcd, 1) === 0;

  const result = binding.mpz_t();
  binding.mpz_init(result);

  if (inverseExists) {
    binding.mpz_mod(result, y, mod);
    if (binding.mpz_sgn(result) < 0) {
      binding.mpz_add(result, result, mod);
    }
  }

  return { inverseExists, result };
}

(async () => {
  const { binding } = await gmp_init();

  const N = binding.mpz_t();
  binding.mpz_init(N);
  binding.mpz_set_string(
    N,
    new Array(BOOK_LENGTH).fill(BASE32_LAST).join(""),
    ALPHA.length
  );

  let randomStartNum = BASE32_LAST;
  for (let i = 1; i < BOOK_LENGTH; i++) {
    randomStartNum +=
      BASE32_ALPHA[Math.floor(Math.random() * BASE32_ALPHA.length)];
  }

  const C = binding.mpz_t();
  binding.mpz_init(C);
  binding.mpz_set_string(C, randomStartNum, ALPHA.length);

  while (true) {
    const foundCoprime = await isCoprime(binding, N, C);

    if (foundCoprime) {
      const { result, inverseExists } = await findModularInverse(binding, N, C);

      if (inverseExists) {
        const nString = binding.mpz_to_string(N, ALPHA.length);
        const cString = binding.mpz_to_string(C, ALPHA.length);
        const iString = binding.mpz_to_string(result, ALPHA.length);

        fs.writeFileSync("numbers", `${nString}\n${cString}\n${iString}`);

        break;
      } else {
        console.log("modular inverse does not exist");
        break;
      }
    }

    binding.mpz_sub_ui(C, C, 1);
  }

  await binding.reset();
})();
