FROM denoland/deno:1.30.3
RUN chown -R deno:deno /plaited

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y wget
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN DEBIAN_FRONTEND=noninteractive apt-get -y install ./google-chrome-stable_current_amd64.deb


WORKDIR /plaited

# Prefer not to run as root.
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY libs/deps.ts libs/deps.ts
COPY libs/test-deps.ts libs/test-deps.ts
RUN deno cache libs/deps.ts libs/test-deps.ts

# These steps will be re-run upon each file change in your working directory:
COPY . .
