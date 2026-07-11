FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@10

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/studio/package.json packages/studio/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build -w @pxml/core
RUN pnpm run build -w @pxml/studio

FROM node:22-alpine

WORKDIR /app
RUN npm install -g pnpm@10

COPY --from=builder /app/packages/studio/dist ./dist
COPY --from=builder /app/packages/core/dist ./node_modules/@pxml/core
COPY --from=builder /app/packages/studio/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/pnpm-workspace.yaml ./

ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "exec", "tsx", "server/index.ts"]
