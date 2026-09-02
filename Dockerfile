FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY sql ./sql

EXPOSE 3100

CMD ["npm", "run", "dev"]
