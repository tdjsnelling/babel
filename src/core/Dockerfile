FROM ubuntu:22.04

WORKDIR /app

RUN apt update && apt -y install \
    build-essential \
    m4 \
    gcc \
    wget

RUN wget --quiet https://gmplib.org/download/gmp/gmp-6.2.1.tar.xz && \
    tar xf ./gmp-6.2.1.tar.xz && \
    cd gmp-6.2.1 && \
    ./configure && \
    make && \
    make install && \
    cd .. && \
    rm -r gmp-6.2.1*

COPY src ./src
COPY Makefile ./Makefile
COPY numbers ./numbers

RUN mkdir bin
RUN make

CMD ["./bin/babel", "-i", "1.1.1.1.1"]
