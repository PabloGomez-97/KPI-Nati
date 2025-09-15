# Multi-stage build para optimizar tamaño
FROM node:18-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar todas las dependencias
RUN npm install --legacy-peer-deps

# Copiar el código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Etapa de producción
FROM node:18-alpine AS production

# Instalar serve globalmente
RUN npm install -g serve

# Crear usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar solo los archivos de build desde la etapa anterior
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist

# Cambiar a usuario no-root
USER nextjs

# IMPORTANTE: Exponer el puerto
EXPOSE 3000

# Comando de inicio
CMD ["serve", "-s", "dist", "-l", "3000"]