FROM node:20-alpine

WORKDIR /app
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["npm", "start"]
