FROM node:20-alpine

RUN apk add --no-cache bash coreutils

# The single-file ESM bundle; Node 20 is the only runtime dependency.
COPY packages/cli/dist/index.js /usr/local/bin/justdrive
RUN chmod +x /usr/local/bin/justdrive \
 && ln -sf /usr/local/bin/justdrive /usr/local/bin/jd

WORKDIR /data
CMD ["sh", "-c", "tail -f /dev/null"]