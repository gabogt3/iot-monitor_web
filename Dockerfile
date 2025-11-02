# Dockerfile

# Usa una imagen base oficial de Node.js ligera (Alpine)
FROM node:20-alpine AS builder

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia el archivo package.json y package-lock.json (si existe)
COPY package*.json ./

# Instala dependencias. Usamos --omit=dev para un entorno de producción más ligero.
RUN npm install --omit=dev

# Copia el código fuente restante
COPY . .

# ===================================================================
# Fase final (runtime) - Mínima y optimizada para producción
# ===================================================================
FROM node:20-alpine

WORKDIR /app

# Copia solo los archivos necesarios de la fase builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
COPY --from=builder /app/public ./public

# El servicio en Cloud Run o GKE/IAP debe escuchar en el puerto 8080
ENV PORT 8080
EXPOSE 8080

# Comando para ejecutar la aplicación
CMD ["node", "server.js"]
