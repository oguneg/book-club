# Bookclub: one image serving the API (/api) and the web app (/).

FROM node:22-bookworm-slim AS build
ENV CI=1 EXPO_NO_TELEMETRY=1
WORKDIR /src
COPY package.json package-lock.json ./
COPY apps/mobile/package.json apps/mobile/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/mobile apps/mobile
# The web app calls the API on its own origin, so no API URL is baked in.
RUN npm run build -w @bookclub/server && npm run build:web -w @bookclub/mobile

# The server is bundled into one file, so the runtime image needs no node_modules.
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    API_PORT=8787 \
    PUBLIC_DIR=public
WORKDIR /app
COPY --from=build /src/apps/server/dist dist
COPY --from=build /src/apps/server/drizzle drizzle
COPY --from=build /src/apps/mobile/dist public
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "--max-old-space-size=256", "dist/server.mjs"]
