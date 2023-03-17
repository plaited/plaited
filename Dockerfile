FROM denoland/deno:1.30.3

# The port that your application listens to.
EXPOSE 9000
EXPOSE 3000

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
# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno task test