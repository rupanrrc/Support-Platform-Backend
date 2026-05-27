FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY .env .env
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
EXPOSE 5000
USER node
CMD ["node", "server.js"]
