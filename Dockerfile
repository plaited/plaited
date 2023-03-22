FROM debian:stable-slim

# Define the Deno version to install
ARG TAG

# Update the package list and install wget, curl, python3, and python3-pip
RUN apt-get update && \
    apt-get install -y wget curl unzip python3 python3-pip

# Install Google Chrome
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    DEBIAN_FRONTEND=noninteractive apt-get -y install ./google-chrome-stable_current_amd64.deb

# Install Selenium
RUN pip install selenium 

# Install Deno with the specified version (TAG)
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s $TAG
RUN export DENO_INSTALL="/root/.local"
RUN export PATH="$DENO_INSTALL/bin:$PATH"
RUN export CHROME_PATH="/usr/bin/google-chrome"

# Cleanup
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /root/.cache/pip/* && \
    rm ./google-chrome-stable_current_amd64.deb

# Set the working directory to /plaited
WORKDIR /plaited

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY libs/deps.ts libs/deps.ts
COPY libs/test-deps.ts libs/test-deps.ts
RUN deno cache libs/deps.ts libs/test-deps.ts


# These steps will be re-run upon each file change in your working directory:
COPY . .
