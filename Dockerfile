FROM node:18-buster
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

COPY package.json ./package.json
COPY yarn.lock ./yarn.lock
COPY binding.gyp ./binding.gyp

COPY src/core ./src/core
COPY src/core/numbers ./numbers

RUN yarn install --production

COPY src ./src

EXPOSE 3000

CMD ["yarn", "start"]
