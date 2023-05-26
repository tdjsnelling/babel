const char *ALPHA = "abcdefghijklmnopqrstuvwxyz., ";
const int ALPHA_LENGTH = 29;
const int WALLS = 4;
const int SHELVES = 5;
const int BOOKS = 32;
const int PAGES = 410;
const int LINES = 40;
const int CHARS = 80;

const int PAGE_LENGTH = LINES * CHARS;
const int BOOK_LENGTH = PAGES * PAGE_LENGTH;

const char *BASE29_ALPHA = "0123456789abcdefghijklmnopqrs";
const char *BASE62_ALPHA =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";