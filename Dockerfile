FROM node:16-alpine
WORKDIR /app
COPY package.json ./package.json
COPY src ./src
RUN yarn install --production
EXPOSE 5000
CMD ["yarn", "start"]
