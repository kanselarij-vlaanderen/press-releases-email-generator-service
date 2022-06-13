# Press release email generator service

This microservice looks for publication tasks that have its publication-channel set to ("verzendlijsten"), are not
started yet (adms:status) and it's publication-event has no ebucore:publicationEndDateTime yet.

for every result found, it generates the email-html, updates the statuses and dates and adds an email to the outbox in
the triplestore.

## How to

### Add the service to your stack
Add the following snippet to your `docker-compose.yml`

```yaml
services:
  email-generator:
    image: kanselarij/press-releases-email-generator-service:0.3.1
    environment:
      EMAIL_FROM: "noreply-vlivia@service.vlaanderen.be"
      EMAIL_TO: "noreply-vlivia@service.vlaanderen.be"
      IMAGE_HOST: "https://vlivia.vlaanderen.be
    volumes:
      - ./data/files:/share
```

and add the following rules to the ``` config/delta/rules.js ```
```javascript
{
    match: {
        predicate: {
            type: 'uri',
            value: 'http://www.w3.org/ns/adms#status',
        },
        object: {
            type: 'uri',
            value: 'http://themis.vlaanderen.be/id/concept/publication-task-status/not-started',
        },
    },
    callback: {
        url: 'http://email-generator/delta',
        method: 'POST',
    },
    options: {
        resourceFormat: 'v0.0.1',
        gracePeriod: 250,
        ignoreFromSelf: true,
    },
}
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
| `EMAIL_TO` | string | 'noreply@vlivia.vlaanderen.be' | mailTo recipient of the email |
| `EMAIL_FROM` | string | 'noreply@vlivia.vlaanderen.be' | sender of the email |
| `IMAGE_HOST` | string | 'http://localhost' | Host the images in the mail template must be served from (must be accessible to the receivers of the email) |
| `BATCH_SIZE` | number | 50 | when an email has more than BATCH_SIZE recipients, it gets split into <amount of recipients/BATCH_SIZE> different emails to be sent to avoid spam listings |
| `OUTBOX_URI` | string | 'http://themis.vlaanderen.be/id/mail-folders/71f0e467-36ef-42cd-8764-5f7c5438ebcf' | outbox uri |




