#include <gmp.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "constants.h"

bool isCoprime(mpz_t a, mpz_t b) {
  mpz_t gcd;
  mpz_init(gcd);
  mpz_gcd(gcd, a, b);

  bool coprime = mpz_cmp_ui(gcd, 1) == 0;

  mpz_clear(gcd);

  return coprime;
}

bool findModularInverse(mpz_t result, mpz_t num, mpz_t mod) {
  mpz_t gcd, x, y;
  mpz_inits(gcd, x, y, NULL);

  mpz_gcdext(gcd, x, y, num, mod);

  bool inverseExists = mpz_cmp_ui(gcd, 1) == 0;

  if (inverseExists) {
    mpz_mod(result, y, mod);
    if (mpz_sgn(result) < 0) {
      mpz_add(result, result, mod);
    }
  }

  mpz_clears(gcd, x, y, NULL);

  return inverseExists;
}

int main() {
  srand(time(NULL));

  char nString[BOOK_LENGTH];

  int n;
  for (n = 0; n < BOOK_LENGTH; n++) {
    sprintf(&nString[n], "%c", 's');
  }

  mpz_t N;
  mpz_init(N);
  mpz_set_str(N, nString, ALPHA_LENGTH);

  char randomStartNum[BOOK_LENGTH];
  randomStartNum[0] = 's';

  for (n = 1; n < BOOK_LENGTH; n++) {
    char randomChar = BASE29_ALPHA[rand() % ALPHA_LENGTH];
    sprintf(&randomStartNum[n], "%c", randomChar);
  }

  mpz_t C;
  mpz_init(C);
  mpz_set_str(C, randomStartNum, ALPHA_LENGTH);

  while (1) {
    bool foundCoprime = isCoprime(N, C);

    if (foundCoprime) {
      mpz_t modInv;
      mpz_init(modInv);
      bool foundModInv = findModularInverse(modInv, N, C);

      if (foundModInv) {
        char nString[BOOK_LENGTH + 1];
        char cString[BOOK_LENGTH + 1];
        char iString[BOOK_LENGTH + 1];

        mpz_get_str(nString, 29, N);
        mpz_get_str(cString, 29, C);
        mpz_get_str(iString, 29, modInv);

        printf("%s\n%s\n%s", nString, cString, iString);

        mpz_clear(modInv);

        break;
      } else {
        printf("modular inverse does not exist\n");
        mpz_clear(modInv);
      }
      
    }

    mpz_sub_ui(C, C, 1);
  }

  mpz_clear(N);
  mpz_clear(C);
  return 0;
}
