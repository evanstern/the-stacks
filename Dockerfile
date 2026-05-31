FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache ocrmypdf poppler-utils tesseract-ocr tesseract-ocr-data-eng
COPY package.json pnpm-lock.yaml ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY app/lib/db/migrations ./build/server/migrations
COPY tsconfig.json ./tsconfig.json
COPY app ./app
COPY scripts/check-startup-env.mjs ./scripts/check-startup-env.mjs
COPY scripts/ocr-worker.ts ./scripts/ocr-worker.ts
COPY scripts/sync-review-retrievability.ts ./scripts/sync-review-retrievability.ts
RUN mkdir -p /app/data/uploads
EXPOSE 3000
CMD ["pnpm", "start"]
