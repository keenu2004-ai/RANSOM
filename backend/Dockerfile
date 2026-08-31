FROM node:22-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
COPY database/ /database/

RUN mkdir -p /backend \
    && ln -s /app/node_modules /backend/node_modules

RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
