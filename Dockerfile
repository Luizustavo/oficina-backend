# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# --ignore-scripts: nenhum pacote roda código próprio durante a instalação.
# Nenhum precisa: o bcrypt já vem compilado (prebuilds) e o `prisma generate`
# logo abaixo baixa os motores do Prisma (consultas e migrações).
RUN npm ci --ignore-scripts
COPY . .
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run prisma:generate
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY package*.json ./
# Roda como o usuário sem privilégios que a imagem oficial do Node já traz,
# e não como root. A aplicação só lê os arquivos acima.
USER node
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
