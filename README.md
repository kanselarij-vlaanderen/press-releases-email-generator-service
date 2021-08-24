# Press release email generator service

This microservice looks for publication tasks that have its publication-channel set to ("verzendlijsten"), are not
started yet (adms:status) and it's publication-event has no ebucore:publicationEndDateTime yet.

for every result found, it generates the email-html, updates the statuses and dates and adds an email to the outbox in
the triplestore.

## How to

### Run the application in development mode

For development, add a docker-compose.override.yml to your main project (app-persberichten), or add the following
service to your existing docker-compose.override.yaml.
(You might have to change the volume path to the root path of this application).

```yaml
services:
  press-release-email-generator:
    image: semtech/mu-javascript-template
    ports:
      - <available-port-on-device>:80
    environment:
      NODE_ENV: "development"
    volumes:
      - ../press-release-email-generator-service/:/app/
```

# Endpoints

## POST /delta

### Responses

| status | description |
|-------|-------------|
| 202 | Accepted, request to check for publication-tasks is successfully received. |

# Environment

| Key | type | default | description |
|-----|------|---------|-------------|
| EMAIL_TO | string | 'noreply@vlivia.vlaanderen.be' | mailTo recipient of the email |
| EMAIL_FROM | string | 'noreply@vlivia.vlaanderen.be' | sender of the email |
| BATCH_SIZE | number | 50 | when an email has more than BATCH_SIZE recipients, it gets split into <amount of recipients/BATCH_SIZE> different emails to be sent to avoid spam listings |
| OUTBOX_URI | string | 'http://themis.vlaanderen.be/id/mail-folders/71f0e467-36ef-42cd-8764-5f7c5438ebcf' | outbox uri |




