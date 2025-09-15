# Usar imagen oficial de Node.js
FROM node:lts-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --legacy-peer-deps

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Instalar serve globalmente
RUN npm install -g serve

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["serve", "-s", "dist", "-l", "3000"]