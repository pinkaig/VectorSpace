FROM node:22-slim AS build

WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages ./packages

RUN npm ci

COPY apps/editor ./apps/editor
COPY apps/runtime ./apps/runtime

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY scripts ./scripts
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -qO- http://localhost/ || exit 1
