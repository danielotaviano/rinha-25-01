FROM node:22.17-alpine3.21

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the application port
EXPOSE 9999

# Set the entry point
CMD ["node", "src/index.js"]
