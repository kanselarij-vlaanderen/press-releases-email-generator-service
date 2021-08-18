import { sparqlEscapeString, uuid, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { querySudo as query } from '@lblod/mu-auth-sudo';
import { EMAIL_FROM } from '../environment';
import { mapBindingValue } from '../helpers/generic-helpers';

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
`;

export async function getPublicationTasksToPublish() {
    // Returns: publication-tasks that:
    // have "adms:status" set to "http://themis.vlaanderen.be/id/concept/publication-task-status/not-started"
    // are linked to the "verzendlijsten" publication channel
    // the linked publication-event has no "ebucore:publicationEndDateTime" yet
    const notStartedStatus = 'http://themis.vlaanderen.be/id/concept/publication-task-status/not-started';
    const verzendlijstenPubChannel = 'http://themis.vlaanderen.be/id/publicatiekanaal/c184f026-feaa-4899-ba06-fd3a03df599c';

    const queryResult = await query(`
    ${PREFIXES}
    SELECT ?publicationTask ?status ?pressRelease ?title  ?graph ?htmlContent ?creatorName
    WHERE {
            GRAPH ?graph {
                ?publicationTask        a                                 ext:PublicationTask;
                                        adms:status                       ${sparqlEscapeUri(notStartedStatus)};
                                        ext:publicationChannel            ${sparqlEscapeUri(verzendlijstenPubChannel)}.
                
                ?pubEvent               prov:generated                    ?publicationTask.
                
                ?pressRelease           ebucore:isScheduledOn             ?pubEvent;
                                        nie:htmlContent                   ?htmlContent;
                                        dct:creator                       ?creator;
                                        nie:title                         ?title.
                                   
                OPTIONAL{?creator       vcard:fn                          ?creatorName}
                
                OPTIONAL{?pubEvent      ebucore:publicationEndDateTime    ?end}
                FILTER (!bound(?end))
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
    const ongoingStatus = 'http://themis.vlaanderen.be/id/concept/publication-task-status/ongoing';
    for (let pubTask of publicationTasks) {
        await query(`
        ${PREFIXES}
        
         DELETE DATA {
           GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?oldStatus ;
                                                                  dct:modified     ?oldDate .
           }
        }
        INSERT DATA {
           GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(ongoingStatus)} ;
                                                                  dct:modified     ${sparqlEscapeDateTime(now)} .
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
    const finishedStatus = 'http://themis.vlaanderen.be/id/concept/publication-task-status/success';
    return await query(`
        ${PREFIXES}
        DELETE DATA {
           GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?oldStatus ;
                                                                  dct:modified     ?oldDate .    
           }
        }
        INSERT DATA {
           GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(finishedStatus)} ;
                                                                  dct:modified     ${sparqlEscapeDateTime(now)} .    
           }
        }
        
        `);
}

export async function saveHtmlContentToPublicationTask(pubTask, html) {
    // The HTML gets stored via nie:htmlContent to the publication task
    const queryResult = await query(`
    ${PREFIXES}
    DELETE DATA {
       GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent 	?oldData .
       }
    }
    INSERT DATA {
       GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent 	${sparqlEscapeString(html)} .
       }
    }
    `);

    return queryResult;

}

export async function pushEmailToOutbox(pubTask, html) {
    const now = new Date();
    const outbox = 'http://themis.vlaanderen.be/id/mail-folders/71f0e467-36ef-42cd-8764-5f7c5438ebcf';
    const recipientBatches = await createRecipientBatches(pubTask);
    const attachmentsQuery = await generateAttachmentsQuery(pubTask);

    console.log(attachmentsQuery);

/*    for (let batch of recipientBatches) {
        const uuid = uuid();
        await query(`
            ${PREFIXES}

            INSERT DATA {
              GRAPH <http://mu.semte.ch/graphs/system/email> {
                <http://themis.vlaanderen.be/id/emails/${uuid}> a nmo:Email;
                    mu:uuid ${uuid} ;
                    nmo:emailBcc ${batch};
                    nmo:messageFrom ${EMAIL_FROM};
                    nmo:messageSubject "${pubTask.title}";
                    nmo:htmlMessageContent ${sparqlEscapeString(html)};
                    nmo:sentDate ${sparqlEscapeDateTime(now)};
                    ${attachmentsQuery}
                    nmo:isPartOf ${sparqlEscapeUri(outbox)} .
              }
            }
        `);
    }*/

}

async function createRecipientBatches(pubTask) {
    // TODO: create batches from recipient email addr


    const q = await query(`
     ${PREFIXES}
     
     SELECT ?contactListItemValue ?contactItemValue
     WHERE {
         GRAPH ${sparqlEscapeUri(pubTask.graph)} {
              ?contactList      ext:contactListHasChannelPublicationEvent   ${sparqlEscapeUri(pubTask.pubEvent)};
                                nco:containsContact                         ?contactListItem.
              ?contactListItem  vcard:hasEmail                              ?email.
              ?email            vcard:hasValue                              ?contactListItemValue.
              
              ?contactItem      ext:contactHasChannelPublicationEvent       ${sparqlEscapeUri(pubTask.pubEvent)};
                                vcard:hasEmail                              ?email.
              ?email            vcard:hasValue                              ?contactItemValue.
         } 
     }
    `)

    console.log(q);

    return [];
}

async function generateAttachmentsQuery(pubTask) {
    // example attachment query string
    // nmo:hasAttachment <http://mu.semte.ch/services/file-service/files/602fa6c6424d81000d000000> ;

    let queryString = '';

    const attachmentsQuery = await query(`
     ${PREFIXES}
     
     SELECT ?attachment
     WHERE {
         GRAPH ${sparqlEscapeUri(pubTask.graph)} {
             ${sparqlEscapeUri(pubTask.pressRelease)} nie:hasPart ?attachment.
         } 
     }
    `);

    attachmentsQuery.results.bindings.forEach((binding)=>{
        queryString += ` nmo:hasAttachment ${sparqlEscapeUri(binding.attachment.value)} ; \n`;
    })

    return queryString;
}
