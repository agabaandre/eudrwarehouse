FROM node:20-alpine AS frontend-build

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY --from=frontend-build /frontend/dist ./public/

RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["sh", "-c", "node src/scripts/migrate.js && node src/scripts/seed.js && node src/server.js"]
