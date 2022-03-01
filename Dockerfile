FROM node:16-alpine
WORKDIR /app
COPY package.json ./package.json
COPY src ./src
RUN yarn install --production
CMD ["yarn", "start"]
