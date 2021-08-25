import { sparqlEscapeUri } from 'mu';
import { querySudo as query } from '@lblod/mu-auth-sudo';
import { mapBindingValue } from '../helpers/generic-helpers';
import { PREFIXES } from './sparql-constants';

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
