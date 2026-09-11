FROM node:22-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
COPY database/ /database/

RUN mkdir -p /backend \
    && ln -s /app/node_modules /backend/node_modules

RUN npm run build

# Ensure node user owns the directories it needs to write to or access
RUN mkdir -p /app/uploads /app/backups \
    && chown -R node:node /app /database /backend

# Switch to non-root user
USER node

EXPOSE 5000

CMD ["npm", "start"]
