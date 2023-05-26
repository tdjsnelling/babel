.PHONY: all babel gen-constants

all: babel gen-constants

babel:
	clang src/babel.c -o bin/babel -lgmp

gen-constants:
	clang src/gen-constants.c -o bin/gen-constants -lgmp

clean:
	rm bin/babel bin/gen-constants
