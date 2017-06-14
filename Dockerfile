FROM cloudron/base:0.10.0
MAINTAINER Authors name <support@cloudron.io>

# Install dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        sudo \
        python3.5 python3-dev python3-setuptools python3-pip python3-venv \
        tesseract-ocr tesseract-ocr-eng imagemagick ghostscript unpaper \
    && rm -rf /var/lib/apt/lists/*

# Clone and install paperless
ENV PAPERLESS_COMMIT 6f635c74fc9ad6a14725fabf24446e8b24dd90af
RUN mkdir -p /app/code/paperless \
    && git clone https://github.com/danielquinn/paperless.git /app/code/paperless \
    && (cd /app/code/paperless && git checkout -q $PAPERLESS_COMMIT) \
    && (cd /app/code/paperless && pip3 install --no-cache-dir -r requirements.txt) \
    # Disable `DEBUG`
    && sed -i 's/DEBUG = True/DEBUG = False/' /app/code/paperless/src/paperless/settings.py

# Migrate data
RUN rm -rf /app/code/paperless/data
RUN rm -rf /app/code/paperless/media/documents/originals
RUN rm -rf /app/code/paperless/media/documents/thumbnails

RUN ln -s /app/data/paperless/data /app/code/paperless/data
RUN ln -s /app/data/paperless/media/documents/originals /app/code/paperless/media/documents/originals
RUN ln -s /app/data/paperless/media/documents/thumbnails /app/code/paperless/media/documents/thumbnails
RUN ln -s /app/data/paperless/paperless.conf /etc/paperless.conf

# Set working directory
WORKDIR /tmp

# Add start script
ADD start.sh /app/code/start.sh

# Add config
ADD paperless.default.conf /app/code/paperless.default.conf

# Add default user (admin/cloudron)
ADD user.db.json /app/code/user.db.json

# Set permissions
RUN chown -Rh cloudron:cloudron /app/code/paperless

# Set entry command to start script
CMD [ "/bin/bash", "/app/code/start.sh" ]