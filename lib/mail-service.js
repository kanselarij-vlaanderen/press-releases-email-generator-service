import Handlebars from 'handlebars';
import path from 'path';
import { minify } from 'html-minifier';
import { readFileSync } from 'fs';
import { getPressReleaseContent,
         getPressReleaseAttachments,
         savePressReleaseText,
         createRecipientBatches,
         prepareEmail } from './query-helper';
import { sparqlEscapeUri } from 'mu';

export async function createEmailContent(publicationTask) {
  console.log(("Generating email content..."));
  const pressRelease = await getPressReleaseContent(publicationTask.graph, publicationTask.pressRelease);

  const htmlContent = generateHtmlContent(pressRelease);
  await savePressReleaseText(publicationTask.graph, publicationTask.uri, htmlContent);

  const pressReleaseData = {
    htmlContent: htmlContent,
    ...pressRelease,
  };

  return pressReleaseData;
}

export async function publishMail(graph, pressRelease) {
  console.log("Publishing press release to email...");

  const now = new Date();
  const recipientBatches = await createRecipientBatches(graph, pressRelease.publicationEvent);

  const attachments = await getPressReleaseAttachments(graph, pressRelease.uri);
  const attachmentsQuery = generateAttachmentsQuery(attachments);

  for (let batch of recipientBatches) {
    const batchQuery = generateEmailToQueryFromBatch(batch);
    await prepareEmail(pressRelease, batchQuery, attachmentsQuery, now);
  }
}

function generateHtmlContent(pressRelease) {
  // Open template file
  const templateSource = readFileSync(path.join(__dirname.replace('lib', 'templates'), '/email.hbs'), 'utf8');
  Handlebars.registerHelper('isdefined', function (value) {
      return value !== undefined;
  });
  // Create email generator
  const template = Handlebars.compile(templateSource);

  const {title, content, creatorName, sources} = pressRelease;
  // generate and return html with variables
  const html = template({title, content, creatorName, sources});
  // return minified html
  return minify(html, {
      removeComments: true,
      collapseWhitespace: true,
      removeEmptyAttributes: true,
  });
}

function generateEmailToQueryFromBatch(batch) {
  const joinedBatch = batch.map(email => sparqlEscapeUri(email)).join(', ');
  return `nmo:emailBcc ${joinedBatch};`;
}

function generateAttachmentsQuery(attachments) {
  let attachmentsQuery = '';
  if (attachments && attachments.length) {
      const joinedAttachments = attachments.map(att => sparqlEscapeUri(att)).join(', ');
      attachmentsQuery = `nmo:hasAttachment ${joinedAttachments};`;
  }
  return attachmentsQuery;
}