import Handlebars from 'handlebars';
import path from 'path';
import { minify } from 'html-minifier';
import { readFileSync } from 'fs';
import { getMailTemplatePath,
         getPressReleaseContent,
         getPressReleaseAttachments,
         savePressReleaseText,
         createRecipientBatches,
         prepareEmail } from './query-helper';
import { sparqlEscapeUri } from 'mu';
import { format } from 'date-fns';
import { nlBE } from 'date-fns/locale';

const IMAGE_HOST = process.env.IMAGE_HOST || 'http://localhost';

export async function createEmailContent(publicationTask) {
  console.log("Generating email content...");
  const pressRelease = await getPressReleaseContent(publicationTask.graph, publicationTask.pressRelease);

  const htmlContent = await generateHtmlContent(pressRelease);
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

async function generateHtmlContent(pressRelease) {
  const filePath = await getMailTemplatePath(pressRelease.uri);
  if (filePath) {
    console.log(`Retrieving mail template from ${filePath}`);
    const templateSource = readFileSync(filePath, 'utf8');

    // Register helpers for handlebars file
    Handlebars.registerHelper('is-present', function (value) {
      return value != null;
    });

    // Create email generator
    const template = Handlebars.compile(templateSource);

    // Generate HTML with filled in variables
    const html = template({
      title: pressRelease.title,
      content: pressRelease.content,
      creatorName: pressRelease.creatorName,
      sources: pressRelease.sources,
      date: format(new Date(), 'eeee d MMMM yyyy', { locale: nlBE }),
      imageHost: IMAGE_HOST
    });


    // Return minified html
    return minify(html, {
      removeComments: true,
      collapseWhitespace: true,
      removeEmptyAttributes: true,
    });
  } else {
    throw new Error(`No template found for creator of press-release ${pressRelease}`);
  }
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
