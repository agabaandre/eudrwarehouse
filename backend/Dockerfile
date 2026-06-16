FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY public/ ./public/

RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["sh", "-c", "node src/scripts/migrate.js && node src/scripts/seed.js && node src/server.js"]
