# Patch1

Has now an API endpoint in index.ts which stores a log file in the directory babel-logs you have to create in the main project folder before. The fun is that it's collecting random pages & words with timestamps automatically when time passes. If you are lucky you get some meaningful results.

How to:
- import the tampermonkey script babel.typescript.highlight.words.js
- yarn build && yarn start in windows cmd
- open http://localhost:3000/ in browser and click on "random"
- monitor the log file changes in powershell or Notepad++ under View and Monitoring (tail -f)

# babel

A functional, complete, true-to-scale re-creation of the [Library of Babel](https://en.wikipedia.org/wiki/The_Library_of_Babel) [[.pdf](https://libraryofbabel.app/pdf/Borges-The-Library-of-Babel.pdf)].

### What is it?

The Library of Babel is a short story written by [Jorge Luis Borges](https://en.wikipedia.org/wiki/Jorge_Luis_Borges).

It describes a library made up of an “indefinite, perhaps infinite” number hexagonal of rooms, each lined on four sides by a bookshelf of five shelves, each self containing thirty-two books. Each book is four hundred and ten pages of forty lines, each line of eighty characters.

In the story, each book is made up of “twenty-five orthographic symbols” consisting of twenty-two lowercase letters, the comma, the full-stop, and the space. This version expands that to thirty-two symbols: the twenty-six lower-case letters of the English alphabet, the comma, full-stop, exclamation mark, question mark, hyphen, and space.

In its pages, the library contains every possible combination of these characters. No two books are the same — meaning that the library is “total — perfect, complete, and whole”. Everything that ever has been, or ever will be written using these thirty-two characters is contained somewhere within the library.

> All-the detailed history of the future, the autobiographies of the archangels, the faithful catalog of the Library, thousands and thousands of false catalogs, the proof of the falsity of those false catalogs, a proof of the falsity of the true catalog, the gnostic gospel of Basilides, the commentary upon that gospel, the commentary on the commentary on that gospel, the true story of your death, the translation of every book into every language, the interpolations of every book into all books, the treatise Bede could have written (but did not) on the mythology of the Saxon people, the lost books of Tacitus. 

This is an explorable representation of the complete library, written in TypeScript.

### Version 3

This is the third version of my implementation of a Library of Babel. 

#### v1

The first was written purely in JavaScript, and contained only all unique *pages*, rather than all unique *books*. 

This meant that a page of prose followed by a page of random characters could not also exist in the library followed by a page of continuing prose. 

The [bignumber.js](https://mikemcl.github.io/bignumber.js/) simply was not capable of working with numbers big enough to build a complete library – in the realm of 29^1312000 rather than 29^3200.

This initial, limited implementation is still available on the `v1` branch.

#### v2

In the second version, the core logic was re-written in C to make use of the [GMP](https://gmplib.org/) library. This combination allowed for much enabled computation using the extremely large numbers required. 

I am not a C programmer, so the code was a mess and likely had some glaring issues that I was not aware of – but it worked. 

The web front-end was still written in JS + Pug, and interacted with the C core via the [Node-API](https://nodejs.org/api/n-api.html).

This version was *slow*, prompting another iteration.

This implementation is still available on the `v2` branch.

#### v3

In this third iteration, the C code is removed in favour of the [gmp-wasm](https://github.com/Daninet/gmp-wasm) GMP<->JS binding.

This means I can work in JS rather than C—which I am much more comfortable with—while still getting the benefits that come with using GMP.

This also means I can do away with the awkward Node-API code and GYP build process. The JavaScript is replaced with TypeScript which helped me catch a few bugs.

Importantly, the 29 character alphabet is expanded to contain 32 characters. This means that calculations are now done in base-32 rather than base-29, resulting much faster conversions in and out of this base-X representation — as this was the primary bottleneck in the slow v2.

### How do I use it?

You can play with a live instance at [libraryofbabel.app](https://libraryofbabel.app).

Alternatively, you can clone this repo and run it yourself.

To build and start on `http://localhost:3000`:

```
$ yarn install
$ yarn build
$ yarn start
```

You can then look up a page at the `/ref/...` endpoint, e.g. `/ref/1.1.1.1.1`.

You can search for a page containing some content at `/search`, navigate to a specific page at `/browse`, and you can visit a random page at `/random`.

### How does it work?

The contents of each book is intrinsically linked to it’s index in the library. Books are not generated and stored as you search for them, as the storage requirements would be beyond possibility. Instead, the book index is run through an algorithm that produces the contents of the book. This algorithm is reversible, so we can give it the contents of a book and determine the index of the book it appears in.

Each book will contain the same contents forever. There is no trickery going on to simply show you a made-up book containing the text that you search for.

You can read more on the [home](https://libraryofbabel.app) and [about](https://libraryofbabel.app/about) pages.

#### Detailed explanation

Firstly, each individual page in the library is given an identifier. For readability, this is represented in the form `ROOM.WALL.SHELF.BOOK.PAGE`, where:

* _ROOM_ is an alphanumeric (`[0-9a-v]`) string treated as a base-32 integer.
* _WALL_ is an integer 1-4.
* _SHELF_ is an integer 1-5.
* _BOOK_ is an integer 1-32.
* _PAGE_ is an integer 1-410.

So using this representation, the 200th page of the 16th book on the 3rd shelf on the 1st wall of the 90th room would be `2q.1.3.16.200`.

Once we have an identifier, from this we can determine a globally unique book index (pages are not considered here). For example:

* The identifier `1.1.1.1.1` gives us book 1.
* The identifier `1.1.1.2.1` gives us book 2.
* The identifier `1.1.2.1.1` gives us book 33
* The identifier `1.2.1.1.1` gives us book 161, and so on.

Now that we have a unique book index, we can do some mathematical operations to generate the contents of the book using the book index as a sort of 'seed'.

We work in base-32, as that is the number of characters in our alphabet. We need to define some constants, which can be found in the `numbers` file.

This file contains `N`, `C` and `I` on 3 separate lines. They are: 

* `N` is largest possible base-32 number of 1,312,000 digits (1,312,000 is the number of characters in a book).
* `C` is a large, randomly generated number that is coprime to `N`.
* `I` is the [modular multiplicative inverse](https://en.wikipedia.org/wiki/Modular_multiplicative_inverse) to `C`.

The code to generate the `numbers` file can be found in `src/utils/gen-constants.ts`. Changing `C` and `I` will change the book index <-> book contents mapping.

A better explanation of why we need these constants can be found in the blog post [A practical use of multiplicative inverses](https://ericlippert.com/2013/11/14/a-practical-use-of-multiplicative-inverses).

The operations we need to perform are:

* `bookContentValue = bookIndex * C % N`, and
* `bookIndex = bookContentValue * I % N`.

`bookContentValue` is a 1,312,000 digit base-32 number. To determine the actual content of the book, we take each digit of this number one-by-one, convert it to base-10, and then select the character at that index of our [alphabet array](./src/constants.ts):
* `0` becomes an `a`
* `k` (or base-10 `20`) becomes a `t`
* `u` (or base-10 `30`) becomes a `?`, and so on.

To turn a book’s text content back into a `bookContentValue`, we just do the opposite: take the index in our alphabet array of each character in the book, convert it to base-32, and append it to a value that becomes our 1,312,000 digit base-32 number `bookContentValue`. Then we can calculate the book index, and thus look it up in the library.

When a specific page is accessed, the entire book is generated and split into 410 pages, and the relevant page is returned.

### Why is a database required if books are not stored on disk?

The alphanumeric room identifiers get very long, up to around 1,000,000 characters. This makes them too long to use in URLs, so the database is responsible for holding 'bookmarks' to each room.

When a room is visited for the first time, it’s SHA-256 hash is calculated and stored in a LevelDB database alongside the actual room identifier. This hash is used in the URL in place of the real room identifier.

#### But are there not way more unique room identifiers than unique hashes?

Correct. In theory, when enough unique rooms are discovered hashes will start to collide, and old bookmarks will start to be overwritten as new rooms are discovered. In reality this very unlikely to happen, as this many rooms will not be visited. 

### Prior art

[Jonathan Basile’s](https://jonathanbasile.info/) brilliant site [libraryofbabel.info](https://libraryofbabel.info/) contains another implementation of the Library of Babel, which contains every unique page, but not every unique book. Jonathan’s site also contains lots of great supplemental theory and ideas around the library. His book on the subject, [Tar for Mortar](https://punctumbooks.com/titles/tar-for-mortar/), is also worth the read.
