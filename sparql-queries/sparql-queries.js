import { sparqlEscapeString, uuid, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { querySudo as query } from '@lblod/mu-auth-sudo';
import { BATCH_SIZE, EMAIL_FROM, EMAIL_TO } from '../environment';
import { mapBindingValue, splitArrayIntoBatches } from '../helpers/generic-helpers';

const VERZENDLIJSTEN_PUBLICATION_CHANNEL = 'http://themis.vlaanderen.be/id/publicatiekanaal/c184f026-feaa-4899-ba06-fd3a03df599c';

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
    const notStartedStatus = 'http://themis.vlaanderen.be/id/concept/publication-task-status/not-started';

    const queryResult = await query(`
    ${PREFIXES}
    SELECT ?publicationTask ?status ?pressRelease ?title  ?graph ?htmlContent ?creatorName ?pubEvent
    WHERE {
            GRAPH ?graph {
                ?publicationTask        a                                 ext:PublicationTask;
                                        adms:status                       ${sparqlEscapeUri(notStartedStatus)};
                                        ext:publicationChannel            ${sparqlEscapeUri(VERZENDLIJSTEN_PUBLICATION_CHANNEL)}.
                
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
        
        
        DELETE {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?s ;
                                                                  dct:modified     ?m .
        }
        INSERT {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;
                                                                  adms:status     ${sparqlEscapeUri(ongoingStatus)} ;
                                                                  dct:modified     ${sparqlEscapeDateTime(now)} .
        }
        WHERE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;
                                                                  adms:status     ?s ;
                                                                  dct:modified     ?m .
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
        DELETE {
            ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?oldStatus;
                                                              dct:modified     ?oldDate.
        }
        INSERT DATA {
            ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(finishedStatus)};
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
    // The HTML gets stored via nie:htmlContent to the publication task
    console.log(html);
    return await query(`
    ${PREFIXES}
    DELETE {
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent 	?oldData.
    }
    INSERT DATA {
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent 	${sparqlEscapeString(html)} .
    } 
    WHERE {
        GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        a                ext:PublicationTask;
                                                               nie:htmlContent 	?oldData.
        }
    }
    `);
}

export async function pushEmailToOutbox(pubTask, html) {
    const now = new Date();
    const outbox = 'http://themis.vlaanderen.be/id/mail-folders/71f0e467-36ef-42cd-8764-5f7c5438ebcf';
    const recipientBatches = await createRecipientBatches(pubTask);
    const attachmentsQuery = await generateAttachmentsQuery(pubTask);

    for (let batch of recipientBatches) {
        const uuid = uuid();
        await query(`
                ${PREFIXES}

                INSERT DATA {
                  GRAPH <http://mu.semte.ch/graphs/system/email> {
                    <http://themis.vlaanderen.be/id/emails/${uuid}> a nmo:Email;
                        mu:uuid ${uuid} ;
                        nmo:emailTo ${EMAIL_TO};
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
    }

}

async function createRecipientBatches(pubTask) {

    const q = await query(`
     ${PREFIXES}
     
     SELECT ?contactListItemValue ?contactItemValue
     WHERE {
         GRAPH ${sparqlEscapeUri(pubTask.graph)} {
             {
                  ?contactList      ext:contactListHasChannelPublicationEvent   ${sparqlEscapeUri(pubTask.pubEvent)};
                                    nco:containsContact                         ?contactListItem.
                  ?contactListItem  vcard:hasEmail                              ?email.
                  ?email            vcard:hasValue                              ?contactListItemValue. 
              } 
              UNION 
              {
                  ?contactItem      ext:contactHasChannelPublicationEvent       ${sparqlEscapeUri(pubTask.pubEvent)};
                                    vcard:hasEmail                              ?email.
                  ?email            vcard:hasValue                              ?contactItemValue.
              }
         } 
     }
    `);

    // create array of email values
    const emails = q.results.bindings.map((item) => {
        return item.contactListItemValue.value ? item.contactListItemValue.value : item.contactItemValue.value;
    });

    // create set to make sure the emails are unique
    const emailSet = new Set(emails);
    console.log('emails', emails);
    console.log('emailSet', emailSet);

    // split the array into batches and return
    return splitArrayIntoBatches(emailSet, BATCH_SIZE);

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

    attachmentsQuery.results.bindings.forEach((binding) => {
        queryString += ` nmo:hasAttachment ${sparqlEscapeUri(binding.attachment.value)} ; \n`;
    });

    return queryString;
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
