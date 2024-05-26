FROM node:18-alpine

WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi

COPY ./src/ ./src/
COPY ./public/ ./public/
COPY ./next.config.mjs ./
COPY ./tailwind.config.js ./
COPY ./postcss.config.js ./
COPY ./jsconfig.json ./
COPY ./.env.development ./

# Next.js collects completely anonymous telemetry data about general usage. Learn more here: https://nextjs.org/telemetry
# Uncomment the following line to disable telemetry at run time
ENV NEXT_TELEMETRY_DISABLED 1

EXPOSE 3000

ENV PORT 3000

CMD BUILD_ENVIRONMENT=docker npm run dev