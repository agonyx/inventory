FROM node:22-slim AS deps
WORKDIR /app/server
COPY server/package.json ./
RUN npm install @hono/node-server && npm install

FROM node:22-slim
WORKDIR /app/server
COPY --from=deps /app/server/node_modules ./node_modules
COPY server/src/ ./src/
COPY server/tsconfig.json ./
COPY server/entrypoint.sh ./
RUN chmod +x entrypoint.sh
EXPOSE 3002
ENV PORT=3002
ENV NODE_ENV=production
CMD ["./entrypoint.sh"]
