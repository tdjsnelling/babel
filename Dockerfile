FROM node:18-buster AS builder
WORKDIR /app

COPY package.json ./package.json
COPY yarn.lock ./yarn.lock

RUN yarn install

COPY src ./src
COPY tsconfig.json ./tsconfig.json

RUN yarn build

FROM node:18-buster
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

RUN yarn install --production

COPY --from=builder /app/dist ./dist
COPY src/views ./src/views
COPY src/public ./src/public
COPY numbers ./numbers

EXPOSE 3000

CMD ["yarn", "start"]
