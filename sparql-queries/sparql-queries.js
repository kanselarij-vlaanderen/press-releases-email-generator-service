import { sparqlEscapeString, uuid as generateUuid, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { BATCH_SIZE, EMAIL_FROM, EMAIL_TO, OUTBOX_URI } from '../environment';
import { mapBindingValue, splitArrayIntoBatches } from '../helpers/generic-helpers';

const VERZENDLIJSTEN_PUBLICATION_CHANNEL = 'http://themis.vlaanderen.be/id/publicatiekanaal/c184f026-feaa-4899-ba06-fd3a03df599c';
const NOT_STARTED_STATUS = 'http://themis.vlaanderen.be/id/concept/publication-task-status/not-started';
const ONGOING_STATUS = 'http://themis.vlaanderen.be/id/concept/publication-task-status/ongoing';
const FINISHED_STATUS = 'http://themis.vlaanderen.be/id/concept/publication-task-status/success';
const FAILED_STATUS = 'http://themis.vlaanderen.be/id/concept/publication-task-status/failed';

const PREFIXES = `
    PREFIX mu: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/')}
    PREFIX nmo: ${sparqlEscapeUri('http://www.semanticdesktop.org/ontologies/2007/03/22/nmo#')}
    PREFIX nie: ${sparqlEscapeUri('http://www.semanticdesktop.org/ontologies/2007/01/19/nie#')}
    PREFIX nfo: ${sparqlEscapeUri('http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#')}
    PREFIX ebucore: ${sparqlEscapeUri('http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#')}
    PREFIX adms: ${sparqlEscapeUri('http://www.w3.org/ns/adms#')}
    PREFIX ext: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/')}
    PREFIX prov: ${sparqlEscapeUri('http://www.w3.org/ns/prov#')}
    PREFIX dct: ${sparqlEscapeUri('http://purl.org/dc/terms/')}
    PREFIX vcard: ${sparqlEscapeUri('http://www.w3.org/2006/vcard/ns#')}
    PREFIX nco: ${sparqlEscapeUri('http://www.semanticdesktop.org/ontologies/2007/03/22/nco#')}
    PREFIX org: ${sparqlEscapeUri('http://www.w3.org/ns/org#')}
    PREFIX fabio: ${sparqlEscapeUri('http://purl.org/spar/fabio/')}
`;

export async function getPublicationTasksToPublish() {
    // Returns: publication-tasks that:
    // have "adms:status" set to "http://themis.vlaanderen.be/id/concept/publication-task-status/not-started"
    // are linked to the "verzendlijsten" publication channel
    // the linked publication-event has no "ebucore:publicationEndDateTime" yet
    const queryResult = await query(`
    ${PREFIXES}
    SELECT ?publicationTask ?status ?pressRelease ?title  ?graph ?htmlContent ?creatorName ?pubEvent
    WHERE {
            GRAPH ?graph {
                ?publicationTask        a                                 ext:PublicationTask;
                                        adms:status                       ${sparqlEscapeUri(NOT_STARTED_STATUS)};
                                        ext:publicationChannel            ${sparqlEscapeUri(VERZENDLIJSTEN_PUBLICATION_CHANNEL)}.
                
                ?pubEvent               prov:generated                    ?publicationTask.
                
                ?pressRelease           ebucore:isScheduledOn             ?pubEvent;
                                        nie:htmlContent                   ?htmlContent;
                                        dct:creator                       ?creator;
                                        nie:title                         ?title.
                                   
                OPTIONAL{ ?creator      vcard:fn                          ?creatorName }
                
                FILTER NOT EXISTS{ ?pubEvent      ebucore:publicationEndDateTime    ?end }
            }
    }
    `);

    return queryResult.results.bindings ? queryResult.results.bindings.map(mapBindingValue) : null;
}

export async function initializePublications(publicationTasks) {
    // for every publication-task the status is changed to:
    // http://themis.vlaanderen.be/id/concept/publication-task-status/ongoing
    // and the modification date to the current time.

    const now = new Date();
    for (let pubTask of publicationTasks) {
        await update(`
        ${PREFIXES}
        
        
        DELETE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?s;
                                                                  dct:modified     ?m.
            }
        }
        INSERT {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;
                                                                  adms:status     ${sparqlEscapeUri(ONGOING_STATUS)};
                                                                  dct:modified     ${sparqlEscapeDateTime(now)}.
            }
        }
        WHERE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;
                                                                  adms:status     ?s;
                                                                  dct:modified     ?m.
            }
        }
        
        `);
    }
}

export async function finalizePublications(pubTask) {
    // for every publication-task the status is changed to:
    // http://themis.vlaanderen.be/id/concept/publication-task-status/ongoing
    // and the modification date to the current time.

    const now = new Date();
    return await update(`
        ${PREFIXES}
        DELETE {
            ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?oldStatus;
                                                              dct:modified     ?oldDate.
        }
        INSERT {
            ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(FINISHED_STATUS)};
                                                              dct:modified     ${sparqlEscapeDateTime(now)}.    
        }
        WHERE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;      
                                                                  adms:status     ?oldStatus;
                                                                  dct:modified     ?oldDate .
            }
        }
        
        `);
}

export async function failPublications(pubTask) {
    const now = new Date();
    return await update(`
        ${PREFIXES}
        DELETE {
            ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?oldStatus;
                                                              dct:modified     ?oldDate.
        }
        INSERT {
            ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(FAILED_STATUS)};
                                                              dct:modified     ${sparqlEscapeDateTime(now)}.    
        }
        WHERE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;      
                                                                  adms:status     ?oldStatus;
                                                                  dct:modified     ?oldDate .
            }
        }
        
        `);
}

export async function saveHtmlContentToPublicationTask(pubTask, html) {
    // Delete old html if it already exists
    await update(`
    ${PREFIXES}
    DELETE {
        GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent 	?oldData.
        }
    }
    WHERE {
        GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        a                ext:PublicationTask;
                                                               nie:htmlContent 	?oldData.
        }
    }
    `);

    // The new HTML gets stored via nie:htmlContent to the publication task
    await update(`
    ${PREFIXES}
    INSERT DATA {
        GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent 	${sparqlEscapeString(html)}.
        }
    }
    `);
}

export async function pushEmailToOutbox(pubTask, html, attachments) {
    const now = new Date();
    let recipientBatches = await createRecipientBatches(pubTask);
    recipientBatches = [['michael.vervloet@test.be', 'edo@test.com']];
    let attachmentsQuery = generateAttachmentsQuery(attachments);
    for (let batch of recipientBatches) {
        const batchQuery = generateEmailToQueryFromBatch(batch);
        const uuid = generateUuid();
        await update(`
                 ${PREFIXES}

                 INSERT DATA {
                   GRAPH <http://mu.semte.ch/graphs/system/email> {
                     <http://themis.vlaanderen.be/id/emails/${uuid}> a nmo:Email;
                         mu:uuid ${sparqlEscapeString(uuid)} ;
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

export async function getPressReleaseAttachments(pubTask) {
    // example attachment query string
    // nmo:hasAttachment <http://mu.semte.ch/services/file-service/files/602fa6c6424d81000d000000> ;

    const attachmentsQuery = await query(`
     ${PREFIXES}
     
     SELECT ?attachment
     WHERE {
         GRAPH ${sparqlEscapeUri(pubTask.graph)} {
             ${sparqlEscapeUri(pubTask.pressRelease)} nie:hasPart ?attachment.
         } 
     }
    `);

    return attachmentsQuery.results.bindings.map(mapBindingValue).map((item) => item.attachment);
}

export async function getPressReleaseSources(pubTask) {

    const q = await query(`
        ${PREFIXES}
        
        SELECT ?source ?fullName ?function ?telephone ?mobile ?email ?organization
        WHERE {
            ${sparqlEscapeUri(pubTask.pressRelease)}    a                   fabio:PressRelease;
                                                        dct:source          ?source.
            ?source                                     a                   ebucore:Contact;
                                                        vcard:fn            ?fullName.
  
            OPTIONAL { ?source                          vcard:role          ?function }
            OPTIONAL{
                ?organizationURI                        a                   vcard:Organization;
                                                        org:hasMember       ?source;
                                                        vcard:fn            ?organization.
            }

            OPTIONAL { 
                ?source             vcard:hasTelephone        ?telephoneURI.
                ?telephoneURI       a                         vcard:Voice;
                                    vcard:hasValue            ?telephone;
                                    ext:publicationChannel    ${sparqlEscapeUri(VERZENDLIJSTEN_PUBLICATION_CHANNEL)}.
            }
            OPTIONAL { 
                ?source            ext:hasMobile              ?mobileURI.
                ?mobileURI         a                          vcard:Cell;
                                   vcard:hasValue             ?mobile;
                                   ext:publicationChannel     ${sparqlEscapeUri(VERZENDLIJSTEN_PUBLICATION_CHANNEL)}. 
            }
            OPTIONAL { 
                ?source            vcard:hasEmail             ?emailURI.
                ?emailURI          a                          vcard:Email;
                                   vcard:hasValue             ?email;
                                   ext:publicationChannel     ${sparqlEscapeUri(VERZENDLIJSTEN_PUBLICATION_CHANNEL)}. 
            }
        }  
    `);

    return q.results.bindings.map(mapBindingValue);

}

function generateAttachmentsQuery(attachments) {
    let attachmentsQuery = '';
    if (attachments && attachments.length) {
        attachmentsQuery = `nmo:hasAttachment `;
        attachments.forEach((attachment) => {
            attachmentsQuery += ` ${sparqlEscapeUri(attachment)},`;
        });
        attachmentsQuery = attachmentsQuery.substring(0, attachmentsQuery.length - 1); // remove last ','
        attachmentsQuery += ';';
    }
    return attachmentsQuery;
}

function generateEmailToQueryFromBatch(batch) {
    let batchQuery = '';
    batchQuery = `nmo:emailBcc `;
    batch.forEach((email) => {
        batchQuery += ` ${sparqlEscapeString(email)},`;
    });
    batchQuery = batchQuery.substring(0, batchQuery.length - 1); // remove last ','
    batchQuery += ';';
    return batchQuery;
}
