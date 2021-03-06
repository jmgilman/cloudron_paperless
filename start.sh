if ! [ -f /app/data/.initialized ]; then
  echo "Fresh installation, setting up data directory..."

  # Create data directories
  mkdir -p /app/data/paperless/consume
  mkdir -p /app/data/paperless/data
  mkdir -p /app/data/paperless/tmp
  mkdir -p /app/data/paperless/media/documents/originals
  mkdir -p /app/data/paperless/media/documents/thumbnails

  # Move config
  cp /app/code/paperless.default.conf /app/data/paperless/paperless.conf

  # Setup email support
  sed -i "s/%PAPERLESS_CONSUME_MAIL_HOST%/${MAIL_IMAP_SERVER}/g" /app/data/paperless/paperless.conf
  sed -i "s/%PAPERLESS_CONSUME_MAIL_PORT%/${MAIL_IMAP_PORT}/g" /app/data/paperless/paperless.conf
  sed -i "s/%PAPERLESS_CONSUME_MAIL_USER%/${MAIL_IMAP_USERNAME}/g" /app/data/paperless/paperless.conf
  sed -i "s/%PAPERLESS_CONSUME_MAIL_PASS%/${MAIL_IMAP_PASSWORD}/g" /app/data/paperless/paperless.conf

  # Mark as keep
  touch /app/data/paperless/data/.keep
  touch /app/data/paperless/media/documents/originals/.keep
  touch /app/data/paperless/media/documents/thumbnails/.keep

  # Migrate the database
  /app/code/paperless/src/manage.py migrate

  # Add the default user
  /app/code/paperless/src/manage.py loaddata /app/code/user.db.json

  # Set permissions
  chown -Rh cloudron:cloudron /app/data/paperless

  # Flag the container has been initialized
  touch /app/data/.initialized
fi

if ! [ -e /app/data/.passphrase ]; then
    echo "Generating encryption passphrase..."
    dd if=/dev/urandom bs=1 count=1024 2>/dev/null | sha1sum | awk '{ print $1 }' > /app/data/.passphrase
    echo "Passphrase stored in /app/data/.passphrase"
fi

export PAPERLESS_PASSPHRASE=$(cat /app/data/.passphrase)
export PAPERLESS_SECRET_KEY=$(cat /app/data/.passphrase)
export PAPERLESS_SCRATCH_DIR="/app/data/paperless/tmp"

exec sudo -HEu cloudron "/app/code/paperless/src/manage.py" "document_consumer" &
exec sudo -HEu cloudron "/app/code/paperless/src/manage.py" "runserver" "--insecure" "0.0.0.0:8000"