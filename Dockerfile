# Use an official, lightweight Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker's build cache
COPY package*.json ./

# Install only production dependencies to keep the image small
RUN npm ci --only=production

# Copy the rest of your application's source code into the container
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Define the command to run your app when the container starts
CMD [ "node", "server.js" ]