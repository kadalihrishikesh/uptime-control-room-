FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY public ./public
EXPOSE 3000
ENV HOST=0.0.0.0
CMD ["npm", "start"]
