.PHONY: all babel gen-constants

all: babel gen-constants

babel:
	gcc src/babel.c -o bin/babel -lgmp

gen-constants:
	gcc src/gen-constants.c -o bin/gen-constants -lgmp

clean:
	rm bin/babel bin/gen-constants
