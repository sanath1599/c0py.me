# Use official Node.js LTS image
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod

COPY . .

EXPOSE 5000
CMD ["pnpm", "start"] 