# babel

An experiment to try and create a functioning Library of Babel.

### What is it?

[The Library of Babel](https://sites.evergreen.edu/politicalshakespeares/wp-content/uploads/sites/226/2015/12/Borges-The-Library-of-Babel.pdf) is a short story written by [Jorge Luis Borges](https://en.wikipedia.org/wiki/Jorge_Luis_Borges).

It describes a library made up of an “indefinite, perhaps infinite” number hexagonal of rooms, each lined on four sides by a bookshelf of five shelves, each self containing thirty-two books. Each book is four hundred and ten pages of forty lines, each line of eighty characters.

The character set in these books is limited to the twenty-six lower-case letters of the English alphabet, the comma, the full-stop, and the space.

In its pages, the library contains every possible combination of these characters. No two books are the same — meaning that the library is “total — perfect, complete, and whole”. Everything that ever has been, or ever will be written using these twenty-nine characters is contained somewhere within the library.

> All-the detailed history of the future, the autobiographies of the archangels, the faithful catalog of the Library, thousands and thousands of false catalogs, the proof of the falsity of those false catalogs, a proof of the falsity of the true catalog, the gnostic gospel of Basilides, the commentary upon that gospel, the commentary on the commentary on that gospel, the true story of your death, the translation of every book into every language, the interpolations of every book into all books, the treatise Bede could have written (but did not) on the mythology of the Saxon people, the lost books of Tacitus. 

This is an explorable representation of the library, written in JavaScript.

### How do I use it?

You can play with a live instance at [libraryofbabel.tdjs.tech](https://libraryofbabel.tdjs.tech).

Alternatively, you can clone this repo and run it yourself with:

```
$ yarn install
$ yarn start
```

You can then look up a page at the `/ref/...` endpoint, e.g. `/ref/1.1.1.1.1`.

You can search for a page containing some content at `/search`, and you can get a random page at `/random`.

### How does it work?

The content of each page is intrinsically linked to its page number. Pages are not generated and stored as you search for them, as the storage requirements would be beyond possibility. Instead, the page number is run through an algorithm that produces the contents of the page. This algorithm is reversible, so we can give it the contents of a page and determine the number of the page it appears on.

Each page will contain the same contents forever. There is no trickery going on to simply show you a made-up page containing the text that you search for.

This implementation is not perfect — in the original story, it is stated that “there are no two identical books”. Due to some reasonable limits of computation, this implementation reduces that to “there are no two identical pages”. Of course then it follows that in this re-creation there are no two identical books, but this also means that searched content cannot span over more than one page. If you search for some text and the following page is gibberish, then in this implementation it cannot also exist followed by a page of continuing prose. Read more on the [limitations](https://libraryofbabel.tdjs.tech/limitations) page.

#### Detailed explanation

Firstly, each individual page in the library is given an identifier. For readability, this is represented in the form `ROOM.WALL.SHELF.BOOK.PAGE`, where:

* _ROOM_ is a lower-case, alphanumeric string treated as a base-36 integer.
* _WALL_ is an integer 1-4.
* _SHELF_ is an integer 1-5.
* _BOOK_ is an integer 1-32.
* _PAGE_ is an integer 1-410.

So using this representation, the 200th page of the 16th book on the 3rd shelf on the 1st wall of the 90th room would be `2i.1.3.16.200`.

Once we have an identifier, from this we can determine a globally unique page number. For example:

* The identifier `1.1.1.1.1` gives us page 1.
* The identifier `1.1.1.2.1` gives us page 411.
* The identifier `1.1.2.1.1` gives us page 13,121, and so on.

At this point you should be able to see that we can quite quickly be working with some very large numbers. To handle such large numbers, we make use of the brilliant [bignumber.js](https://mikemcl.github.io/bignumber.js/#) library.

Now that we have a unique page number, we can do some clever mathematical operations to generate the contents of the page using the page number as a sort of 'seed'.

We work in base-29, as that is the number of characters in our alphabet. We need to define some constants, which can be found in `src/constants.js`:

* `N` is largest possible base-29 number of 3200 digits (3200 is the number of characters on a page).
* `c` is a large, randomly generated number that is coprime to `N`.
* `i` is the [modular multiplicative inverse](https://en.wikipedia.org/wiki/Modular_multiplicative_inverse) to `c`.

The code to generate both `c` and `i` can be found in `src/utils/generateMIPair.js`.

A better explanation of why we need these constants can be found in the blog post [A practical use of multiplicative inverses](https://ericlippert.com/2013/11/14/a-practical-use-of-multiplicative-inverses).

The operations we need to perform are:

* `pageContentValue = pageNumber * c % N`, and
* `pageNumber = pageContentValue * i % N`.

`pageContentValue` is a 3200 digit base-29 number. To determine the actual content of the page, we take each digit of this number, convert it to base-10, and then select the character at that index of our alphabet array.

To turn a page’s text content back into a `pageContentValue`, we just do the opposite: take the index in our alphabet array of each character on the page, convert it to base-29, and append it to a value that becomes our 3200 digit base-29 number. Then we can calculate the page number, and thus look it up in the library.

### Prior art

[Jonathan Basile’s](https://jonathanbasile.info/) brilliant site [libraryofbabel.info](https://libraryofbabel.info/) contains another implementation of the Library of Babel, which I think works in a similar but slightly different way. The site also contains lots of supplemental theory and ideas around the library.
