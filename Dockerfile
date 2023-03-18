FROM denoland/deno:1.30.3

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y gnupg
 
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \ 
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
RUN apt-get update && \
DEBIAN_FRONTEND=noninteractive apt-get -y install google-chrome-stable


WORKDIR /plaited

# Prefer not to run as root.
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY libs/deps.ts .
COPY libs/test-deps.ts .
RUN deno cache libs/deps.ts libs/test-deps.ts

# These steps will be re-run upon each file change in your working directory:
COPY . .