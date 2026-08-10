FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
ENV REACT_APP_API=/api
EXPOSE 3000
CMD ["npm", "start"]
