import { init as gmp_init } from "gmp-wasm";
import { initialiseNumbers } from "../babel";

(async () => {
  const { binding } = await gmp_init();

  const { N, C, I } = await initialiseNumbers(binding);

  const input = binding.mpz_t();
  binding.mpz_init_set_ui(input, 1);

  const encoded = binding.mpz_t();
  binding.mpz_init(encoded);
  binding.mpz_mul(encoded, C, input);
  binding.mpz_mod(encoded, encoded, N);

  const output = binding.mpz_t();
  binding.mpz_init_set(output, encoded);
  binding.mpz_mul(output, output, I);
  binding.mpz_mod(output, output, N);

  console.log(binding.mpz_cmp(input, output) === 0);

  await binding.reset();
})();
