FROM node:20-slim

# Imposta la directory di lavoro nel container
WORKDIR /app

# Copia i file package.json e package-lock.json
COPY package*.json ./

# Installa le dipendenze del progetto
RUN npm install --production

# Copia tutto il codice del progetto nel container
COPY . .

# Esponi la porta predefinita (Hugging Face imposterà automaticamente la variabile PORT a 7860)
EXPOSE 7860

# Comando di avvio del server
CMD ["node", "server.js"]
