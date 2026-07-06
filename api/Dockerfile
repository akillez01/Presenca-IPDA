FROM node:18-alpine

# Define diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências de produção
RUN npm ci --only=production

# Copia código compilado (deve fazer npm run build antes)
COPY dist ./dist

# Expõe porta
EXPOSE 3001

# Variáveis de ambiente padrão
ENV NODE_ENV=production

# Comando de inicialização
CMD ["node", "dist/src/index.js"]
