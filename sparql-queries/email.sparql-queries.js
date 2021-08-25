import { sparqlEscapeString, uuid as generateUuid, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { generateAttachmentsQuery } from './attachments.sparql-queries';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { mapBindingValue, splitArrayIntoBatches } from '../helpers/generic-helpers';
import { BATCH_SIZE, EMAIL_FROM, EMAIL_TO, OUTBOX_URI } from '../environment';
import { PREFIXES } from './sparql-constants';

export async function pushEmailToOutbox(pubTask, html, attachments) {
    const now = new Date();
    const recipientBatches = await createRecipientBatches(pubTask);
    const attachmentsQuery = generateAttachmentsQuery(attachments);

    for (let batch of recipientBatches) {
        const batchQuery = generateEmailToQueryFromBatch(batch);
        const uuid = generateUuid();
        await update(`
                 ${PREFIXES}

                 INSERT DATA {
                   GRAPH <http://mu.semte.ch/graphs/system/email> {
                     <http://themis.vlaanderen.be/id/emails/${uuid}> a nmo:Email;
                         mu:uuid ${sparqlEscapeString(uuid)};
                         nmo:emailTo ${sparqlEscapeString(EMAIL_TO)};
                         ${batchQuery}
                         nmo:messageFrom ${sparqlEscapeString(EMAIL_FROM)};
                         nmo:messageSubject ${sparqlEscapeString(pubTask.title)};
                         nmo:htmlMessageContent ${sparqlEscapeString(html)};
                         nmo:sentDate ${sparqlEscapeDateTime(now)};
                         ${attachmentsQuery}
                         nmo:isPartOf ${sparqlEscapeUri(OUTBOX_URI)} .
                   }
                 }
             `);
    }
}

export async function createRecipientBatches(pubTask) {

    const q = await query(`
     ${PREFIXES}

     SELECT DISTINCT ?value
     WHERE {
         GRAPH ${sparqlEscapeUri(pubTask.graph)} {
             {
                  ?contactList      ext:contactListHasChannelPublicationEvent   ${sparqlEscapeUri(pubTask.pubEvent)};
                                    nco:containsContact                         ?contactListItem.
                  ?contactListItem  vcard:hasEmail                              ?email.
                  ?email            vcard:hasValue                              ?value.
              }
              UNION
              {
                  ?contactItem      ext:contactHasChannelPublicationEvent       ${sparqlEscapeUri(pubTask.pubEvent)};
                                    vcard:hasEmail                              ?email.
                  ?email            vcard:hasValue                              ?value.
              }
         }
     }
    `);

    // map array of email values
    const emails = q.results.bindings.map(mapBindingValue).map(item => item.value);

    // split the array into batches and return
    return splitArrayIntoBatches(emails, BATCH_SIZE);

}

function generateEmailToQueryFromBatch(batch) {
    const joinedBatch = batch.map(email => sparqlEscapeUri(email)).join(', ');
    return `nmo:emailBcc ${joinedBatch};`;
}
