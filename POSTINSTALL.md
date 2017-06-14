Paperless is installed with a default set of credentials:

**Username**: admin

**Password**: cloudron

After installation, please login and change the password to something unique.

There are three ways to upload files to Paperless:

* Push the file to the consume folder using the Cloudron CLI tool: `cloudron push my-pdf.pdf /app/data/paperless/consume/my-pdf.pdf`
* POST the file to the consume folder: [see here](https://paperless.readthedocs.io/en/latest/consumption.html#http-post) for examples
* Email the file to {App Location}.app@{Your domain}. The subject is the same format as file names (see below), only attach **one** file to the email, and in the body of the email you'll need to **include your shared secret**. This is by default set to `cloudron123`, however it's highly recommended you edit `/app/data/paperless/paperless.conf` and change `PAPERLESS_SHARED_SECRET` to something unique.

File names determine how Paperless processes uploaded files, please [see here](https://paperless.readthedocs.io/en/latest/guesswork.html#file-naming) for more details.