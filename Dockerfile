FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose the port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
