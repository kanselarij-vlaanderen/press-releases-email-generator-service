import { sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { mapBindingValue } from '../helpers/generic-helpers';
import {
    FAILED_STATUS, FINISHED_STATUS,
    NOT_STARTED_STATUS,
    ONGOING_STATUS,
    PREFIXES,
    VERZENDLIJSTEN_PUBLICATION_CHANNEL,
} from './sparql-constants';

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
                ?publicationTask a ext:PublicationTask;
                  adms:status ${sparqlEscapeUri(NOT_STARTED_STATUS)};
                  ext:publicationChannel ${sparqlEscapeUri(VERZENDLIJSTEN_PUBLICATION_CHANNEL)}.

                ?pubEvent prov:generated ?publicationTask.

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
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(ONGOING_STATUS)};
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

export async function finalizePublication(pubTask) {
    const now = new Date();
    return await update(`
        ${PREFIXES}
        DELETE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?oldStatus;
                                                                dct:modified     ?oldDate.
            }
        }
        INSERT {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(FINISHED_STATUS)};
                                                                dct:modified     ${sparqlEscapeDateTime(now)}.
            }
        }
        WHERE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;
                                                                  adms:status     ?oldStatus;
                                                                  dct:modified     ?oldDate.
            }
        }
        `);
}

export async function failPublication(pubTask) {
    const now = new Date();
    return await update(`
        ${PREFIXES}
        DELETE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ?oldStatus;
                                                                dct:modified     ?oldDate.
            }
        }
        INSERT {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       adms:status     ${sparqlEscapeUri(FAILED_STATUS)};
                                                                dct:modified     ${sparqlEscapeDateTime(now)}.
            }
        }
        WHERE {
            GRAPH ${sparqlEscapeUri(pubTask.graph)} {
                ${sparqlEscapeUri(pubTask.publicationTask)}       a               ext:PublicationTask;
                                                                  adms:status     ?oldStatus;
                                                                  dct:modified     ?oldDate.
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
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent  ?oldData.
        }
    }
    WHERE {
        GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        a                ext:PublicationTask;
                                                               nie:htmlContent  ?oldData.
        }
    }
    `);

    // The new HTML gets stored via nie:htmlContent to the publication task
    await update(`
    ${PREFIXES}
    INSERT DATA {
        GRAPH ${sparqlEscapeUri(pubTask.graph)} {
            ${sparqlEscapeUri(pubTask.publicationTask)}        nie:htmlContent  ${sparqlEscapeString(html)}.
        }
    }
    `);
}
