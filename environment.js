export const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;
export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@vlivia.vlaanderen.be';
export const EMAIL_TO = process.env.EMAIL_TO || 'noreply@vlivia.vlaanderen.be';
export const OUTBOX_URI = process.env.OUTBOX_URI || 'http://themis.vlaanderen.be/id/mail-folders/71f0e467-36ef-42cd-8764-5f7c5438ebcf';
