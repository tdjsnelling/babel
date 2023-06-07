/*
  babel.c
  Tom Snelling 2023
  A complete Library of Babel in under 700 LOC
*/

#include <assert.h>
#include <gmp.h>
#include <node_api.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <time.h>
#include <unistd.h>

#include "constants.h"

typedef struct {
  char *content;
  char *roomShort;
  char *room;
  char *wall;
  char *shelf;
  char *book;
  char *page;
  char *prevIdentifier;
  char *nextIdentifier;
} PageData;

/*
  Get a sequential book index from an identifier in the format `1.1.1.1.1`.
*/
long getSequentialContentNumberFromIdentifier(mpz_t seqNumber, char *identifier,
                                              napi_env env) {
  char *tokens[5];
  char *copy = strdup(identifier);
  char *token = strtok(copy, ".");

  int count = 0;
  while (token != NULL && count < 5) {
    tokens[count++] = token;
    token = strtok(NULL, ".");
  }

  mpz_t intRoom;
  mpz_init(intRoom);
  mpz_set_str(intRoom, tokens[0], 62);

  if (mpz_cmp_ui(intRoom, 1) < 0) {
    napi_throw_error(env, NULL, "room cannot be smaller than 1");
  }

  mpz_t totalRooms;
  mpz_init(totalRooms);
  mpz_set_ui(totalRooms, ALPHA_LENGTH);
  mpz_pow_ui(totalRooms, totalRooms, BOOK_LENGTH);  // total unique books
  mpz_tdiv_q_ui(totalRooms, totalRooms, BOOKS * SHELVES * WALLS);

  if (mpz_cmp(intRoom, totalRooms) > 0) {
    napi_throw_error(env, NULL, "room is too large");
  }

  char *remaining;
  long parsedPage = strtol(tokens[4], &remaining, 10);
  if (parsedPage < 1 || parsedPage > PAGES) {
    napi_throw_error(env, NULL, "page must be between 1 and 410");
  }

  long parsedBook = strtol(tokens[3], &remaining, 10);
  if (parsedBook < 1 || parsedBook > BOOKS) {
    napi_throw_error(env, NULL, "book must be between 1 and 32");
  }

  long parsedShelf = strtol(tokens[2], &remaining, 10);
  if (parsedShelf < 1 || parsedShelf > SHELVES) {
    napi_throw_error(env, NULL, "shelf must be between 1 and 5");
  }

  long parsedWall = strtol(tokens[1], &remaining, 10);
  if (parsedWall < 1 || parsedWall > WALLS) {
    napi_throw_error(env, NULL, "wall must be between 1 and 4");
  }

  long pBooks = parsedBook;
  long pShelves = (parsedShelf - 1) * BOOKS;
  long pWalls = (parsedWall - 1) * SHELVES * BOOKS;

  mpz_t pRooms;
  mpz_init(pRooms);
  mpz_sub_ui(pRooms, intRoom, 1);
  mpz_mul_ui(pRooms, pRooms, WALLS * SHELVES * BOOKS);

  mpz_add_ui(seqNumber, pRooms, pWalls + pShelves + pBooks);

  mpz_clear(intRoom);
  mpz_clear(totalRooms);
  mpz_clear(pRooms);

  return parsedPage;
}

/*
  Get an identifier in the format `1.1.1.1.1` from a sequential book index.
*/
char *getIdentifierFromSequentialContentNumber(mpz_t seqNumber, int page) {
  mpz_sub_ui(seqNumber, seqNumber, 1);

  if (mpz_sgn(seqNumber) == -1) {
    return "1.1.1.1.1";
  }

  mpz_t room;
  mpz_init(room);
  mpz_tdiv_q_ui(room, seqNumber, WALLS * SHELVES * BOOKS);
  mpz_add_ui(room, room, 1);
  mpz_mod_ui(seqNumber, seqNumber, WALLS * SHELVES * BOOKS);

  mpz_t wall;
  mpz_init(wall);
  mpz_tdiv_q_ui(wall, seqNumber, SHELVES * BOOKS);
  mpz_add_ui(wall, wall, 1);
  mpz_mod_ui(seqNumber, seqNumber, SHELVES * BOOKS);

  mpz_t shelf;
  mpz_init(shelf);
  mpz_tdiv_q_ui(shelf, seqNumber, BOOKS);
  mpz_add_ui(shelf, shelf, 1);
  mpz_mod_ui(seqNumber, seqNumber, BOOKS);

  mpz_add_ui(seqNumber, seqNumber, 1);

  char roomString[BOOK_LENGTH] = "";
  mpz_get_str(roomString, 62, room);

  static char identifier[BOOK_LENGTH] = "";
  gmp_sprintf(identifier, "%s.%Zd.%Zd.%Zd.%d", roomString, wall, shelf,
              seqNumber, page);

  mpz_clear(room);
  mpz_clear(wall);
  mpz_clear(shelf);

  return identifier;
}

/*
  Given a page identifier, determine the book index of that identifier and then
  calculate the resulting book contents via modular multiplication.
*/
PageData generateContent(char *identifier, mpz_t C, mpz_t N, napi_env env) {
  mpz_t seqNumber;
  mpz_init(seqNumber);
  long page =
      getSequentialContentNumberFromIdentifier(seqNumber, identifier, env);

  mpz_t result;
  mpz_init(result);
  mpz_mul(result, C, seqNumber);
  mpz_mod(result, result, N);

  mpz_clear(C);
  mpz_clear(N);

  char hash[BOOK_LENGTH + 1] = "";
  mpz_get_str(hash, ALPHA_LENGTH, result);

  mpz_clear(result);

  int currentLength = strlen(hash);
  if (currentLength < BOOK_LENGTH) {
    int paddingRequired = BOOK_LENGTH - currentLength;
    char paddedHash[BOOK_LENGTH + 1] = "";

    for (int z = 0; z < paddingRequired; z++) {
      paddedHash[z] = '0';
    }

    strcpy(paddedHash + paddingRequired, hash);
    paddedHash[BOOK_LENGTH] = '\0';
    strcpy(hash, paddedHash);
  }

  char content[BOOK_LENGTH + 1] = "";
  long start = (page - 1) * PAGE_LENGTH;
  int i;
  for (i = start; i < start + PAGE_LENGTH; i++) {
    char currentChar = hash[i];
    char currentStr[2];
    currentStr[0] = currentChar;
    currentStr[1] = '\0';
    char *remaining;
    long int index = strtol(currentStr, &remaining, ALPHA_LENGTH);

    if (index >= 0 && index < ALPHA_LENGTH) {
      char newChar = ALPHA[index];
      strncat(content, &newChar, 1);
    }
  }

  char *tokens[5];
  char *copy = strdup(identifier);
  char *token = strtok(copy, ".");

  int count = 0;
  while (token != NULL && count < 5) {
    tokens[count++] = token;
    token = strtok(NULL, ".");
  }

  char *room = tokens[0];
  char roomShort[20] = "";

  if (strlen(room) > 16) {
    char firstEight[9] = "";
    char lastEight[9] = "";
    strncpy(firstEight, room, 8);
    strncpy(lastEight, &room[strlen(room) - 8], 8);
    firstEight[8] = '\0';
    lastEight[8] = '\0';
    sprintf(roomShort, "%s...%s", firstEight, lastEight);
  } else {
    sprintf(roomShort, "%s", room);
  }

  mpz_t nextSeqNumber;
  mpz_init(nextSeqNumber);
  mpz_set(nextSeqNumber, seqNumber);
  int nextPage = page;

  if (nextPage == PAGES) {
    mpz_add_ui(nextSeqNumber, nextSeqNumber, 1);
    nextPage = 1;
  } else {
    nextPage++;
  }

  char nextIdentifier[BOOK_LENGTH] = "";
  sprintf(nextIdentifier, "%s",
          getIdentifierFromSequentialContentNumber(nextSeqNumber, nextPage));

  mpz_clear(nextSeqNumber);

  mpz_t prevSeqNumber;
  mpz_init(prevSeqNumber);
  mpz_set(prevSeqNumber, seqNumber);
  int prevPage = page;

  if (prevPage == 1) {
    mpz_sub_ui(prevSeqNumber, prevSeqNumber, 1);
    prevPage = 410;
  } else {
    prevPage--;
  }

  char prevIdentifier[BOOK_LENGTH] = "";
  sprintf(prevIdentifier, "%s",
          getIdentifierFromSequentialContentNumber(prevSeqNumber, prevPage));

  mpz_clear(prevSeqNumber);
  mpz_clear(seqNumber);

  PageData data;
  data.content = content;
  data.roomShort = roomShort;
  data.room = room;
  data.wall = tokens[1];
  data.shelf = tokens[2];
  data.book = tokens[3];
  data.page = tokens[4];
  data.prevIdentifier = prevIdentifier;
  data.nextIdentifier = nextIdentifier;

  return data;
}

/*
  Given some content as a string, pad that string to BOOK_LENGTH, transform it
  into a base-29 'hash', and calculate it's book index via modular
  multiplication.
*/
char *lookupContent(char *content, mpz_t I, mpz_t N, int page, napi_env env) {
  char paddedContent[BOOK_LENGTH + 1] = "";
  strncpy(paddedContent, content, sizeof(paddedContent) - 1);
  paddedContent[sizeof(paddedContent) - 1] = '\0';

  int i;
  if (strlen(paddedContent) < BOOK_LENGTH) {
    for (i = strlen(content); i < BOOK_LENGTH; i++) {
      paddedContent[i] = ' ';
    }
  }
  paddedContent[BOOK_LENGTH] = '\0';

  char hash[BOOK_LENGTH + 1] = "";
  for (int i = 0; i < BOOK_LENGTH; i++) {
    char currentChar = paddedContent[i];
    char *c;
    c = rawmemchr(ALPHA, currentChar);
    int charIndex = (int)(c - ALPHA);
    if (charIndex < 0 || charIndex >= ALPHA_LENGTH) {
      napi_throw_error(
          env, NULL,
          "content can only consist of letters a-z, space, comma and "
          "full-stop\n");
    }
    hash[i] = BASE29_ALPHA[charIndex];
  }
  hash[BOOK_LENGTH] = '\0';

  mpz_t seqNumber;
  mpz_init(seqNumber);
  mpz_set_str(seqNumber, hash, ALPHA_LENGTH);

  mpz_mul(seqNumber, seqNumber, I);
  mpz_clear(I);

  mpz_mod(seqNumber, seqNumber, N);

  char *identifier = getIdentifierFromSequentialContentNumber(seqNumber, page);

  mpz_clear(seqNumber);

  return identifier;
}

/*
  Generate and return a random page identifier.
*/
char *getRandomIdentifier() {
  gmp_randstate_t randState;
  gmp_randinit_default(randState);
  gmp_randseed_ui(randState, time(NULL));

  mpz_t randomSeqNumber;
  mpz_init(randomSeqNumber);

  mpz_t uniqueBooks;
  mpz_init(uniqueBooks);
  mpz_set_ui(uniqueBooks, ALPHA_LENGTH);
  mpz_pow_ui(uniqueBooks, uniqueBooks, BOOK_LENGTH);

  mpz_urandomm(randomSeqNumber, randState, uniqueBooks);
  mpz_add_ui(randomSeqNumber, randomSeqNumber, 1);

  mpz_clear(uniqueBooks);

  mpz_t randomPage;
  mpz_init(randomPage);

  mpz_t pages;
  mpz_init(pages);
  mpz_set_ui(pages, PAGES);

  mpz_urandomm(randomPage, randState, pages);
  mpz_add_ui(randomPage, randomPage, 1);

  mpz_clear(pages);

  return getIdentifierFromSequentialContentNumber(randomSeqNumber,
                                                  mpz_get_ui(randomPage));
}

/*
  Read from `numbers` file and initialise mpz_t constants.
*/
void initialiseNumbers(mpz_t N, mpz_t C, mpz_t I) {
  char N_STR[BOOK_LENGTH + 1] = "";
  char C_STR[BOOK_LENGTH + 1] = "";
  char I_STR[BOOK_LENGTH + 1] = "";

  FILE *fptr = fopen("numbers", "r");
  if (fptr != NULL) {
    fscanf(fptr, "%s\n%s\n%s", N_STR, C_STR, I_STR);
  } else {
    printf(
        "could not open numbers file. generate it with './gen-constants > "
        "numbers'\n");
    abort();
  }

  mpz_init(N);
  mpz_set_str(N, N_STR, ALPHA_LENGTH);

  mpz_init(C);
  mpz_set_str(C, C_STR, ALPHA_LENGTH);

  mpz_init(I);
  mpz_set_str(I, I_STR, ALPHA_LENGTH);
}

/*
  Default stack size limit may be too small as we are working with very large
  variables. Increase to avoid problems (Linux only?).
*/
void setRLimit() {
  const rlim_t kStackSize = 16L * 1024L * 1024L;  // 16 MB
  struct rlimit rl;
  int result;

  result = getrlimit(RLIMIT_STACK, &rl);
  if (result == 0) {
    if (rl.rlim_cur < kStackSize) {
      rl.rlim_cur = kStackSize;
      result = setrlimit(RLIMIT_STACK, &rl);
      if (result != 0) {
        fprintf(stderr, "setrlimit returned result = %d\n", result);
      }
    }
  }
}

/*
  Node-API wrapper to generateContent().
*/
static napi_value napiGenerateContent(napi_env env, napi_callback_info info) {
  setRLimit();

  mpz_t N, C, I;
  initialiseNumbers(N, C, I);

  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  size_t str_size;
  size_t str_size_read;
  napi_get_value_string_utf8(env, args[0], NULL, 0, &str_size);
  char *identifier;
  identifier = (char *)calloc(str_size + 1, sizeof(char));
  str_size = str_size + 1;
  napi_get_value_string_utf8(env, args[0], identifier, str_size,
                             &str_size_read);

  PageData pageData = generateContent(identifier, C, N, env);

  napi_value data;

  napi_create_object(env, &data);

  napi_value contentValue;
  napi_create_string_utf8(env, pageData.content, NAPI_AUTO_LENGTH,
                          &contentValue);
  napi_set_named_property(env, data, "content", contentValue);

  napi_value roomShortValue;
  napi_create_string_utf8(env, pageData.roomShort, NAPI_AUTO_LENGTH,
                          &roomShortValue);
  napi_set_named_property(env, data, "roomShort", roomShortValue);

  napi_value roomValue;
  napi_create_string_utf8(env, pageData.room, NAPI_AUTO_LENGTH, &roomValue);
  napi_set_named_property(env, data, "room", roomValue);

  napi_value wallValue;
  napi_create_string_utf8(env, pageData.wall, NAPI_AUTO_LENGTH, &wallValue);
  napi_set_named_property(env, data, "wall", wallValue);

  napi_value shelfValue;
  napi_create_string_utf8(env, pageData.shelf, NAPI_AUTO_LENGTH, &shelfValue);
  napi_set_named_property(env, data, "shelf", shelfValue);

  napi_value bookValue;
  napi_create_string_utf8(env, pageData.book, NAPI_AUTO_LENGTH, &bookValue);
  napi_set_named_property(env, data, "book", bookValue);

  napi_value pageValue;
  napi_create_string_utf8(env, pageData.page, NAPI_AUTO_LENGTH, &pageValue);
  napi_set_named_property(env, data, "page", pageValue);

  napi_value prevIdentifierValue;
  napi_create_string_utf8(env, pageData.prevIdentifier, NAPI_AUTO_LENGTH,
                          &prevIdentifierValue);
  napi_set_named_property(env, data, "prevIdentifier", prevIdentifierValue);

  napi_value nextIdentifierValue;
  napi_create_string_utf8(env, pageData.nextIdentifier, NAPI_AUTO_LENGTH,
                          &nextIdentifierValue);
  napi_set_named_property(env, data, "nextIdentifier", nextIdentifierValue);

  return data;
}

/*
  Node-API wrapper to lookupContent().
*/
static napi_value napiLookupContent(napi_env env, napi_callback_info info) {
  setRLimit();

  mpz_t N, C, I;
  initialiseNumbers(N, C, I);

  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);

  size_t str_size;
  size_t str_size_read;
  napi_get_value_string_utf8(env, args[0], NULL, 0, &str_size);
  char *input;
  input = (char *)calloc(str_size + 1, sizeof(char));
  str_size = str_size + 1;
  napi_get_value_string_utf8(env, args[0], input, str_size, &str_size_read);

  int pageNumber;
  napi_get_value_int32(env, args[1], &pageNumber);

  char *foundIdentifier = lookupContent(input, I, N, pageNumber, env);

  napi_value identifier;
  napi_create_string_utf8(env, foundIdentifier, NAPI_AUTO_LENGTH, &identifier);

  return identifier;
}

/*
  Node-API wrapper to getRandomIdentifier().
*/
static napi_value napiGetRandomIdentifier(napi_env env,
                                          napi_callback_info info) {
  setRLimit();

  mpz_t N, C, I;
  initialiseNumbers(N, C, I);

  char *randomIdentifier = getRandomIdentifier();

  napi_value identifier;
  napi_create_string_utf8(env, randomIdentifier, NAPI_AUTO_LENGTH, &identifier);

  return identifier;
}

#define DECLARE_NAPI_METHOD(name, func) \
  { name, 0, func, 0, 0, 0, napi_default, 0 }

/*
  Entrypoint for Node-API.
*/
static napi_value napiInit(napi_env env, napi_value exports) {
  napi_status status;
  napi_property_descriptor descriptors[] = {
      DECLARE_NAPI_METHOD("getPage", napiGenerateContent),
      DECLARE_NAPI_METHOD("searchContent", napiLookupContent),
      DECLARE_NAPI_METHOD("getRandomIdentifier", napiGetRandomIdentifier)};
  status = napi_define_properties(
      env, exports, sizeof(descriptors) / sizeof(descriptors[0]), &descriptors);
  assert(status == napi_ok);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, napiInit);
