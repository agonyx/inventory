FROM node:22-slim AS deps
WORKDIR /app/server
COPY server/package.json ./
RUN npm install @hono/node-server && npm install

FROM node:22-slim
WORKDIR /app/server
COPY --from=deps /app/server/node_modules ./node_modules
COPY server/src/ ./src/
COPY server/tsconfig.json ./
EXPOSE 3002
ENV PORT=3002
CMD ["npx", "tsx", "src/index.ts"]
