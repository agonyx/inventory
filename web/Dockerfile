FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY package.json bun.lock ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN bun install
COPY web/ ./web/
WORKDIR /app/web
RUN bun run build

FROM nginx:alpine
COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD nginx -g 'daemon off;'
