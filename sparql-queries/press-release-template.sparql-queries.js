import { sparqlEscapeString, query } from 'mu';
import { PREFIXES } from './sparql-constants';
import { mapBindingValue } from '../helpers/generic-helpers';

export async function getPressReleaseById(id) {
    const q = await (query(`
    ${PREFIXES}
    SELECT ?pressRelease ?htmlContent ?creator ?title ?creatorName
    WHERE {
           ?pressRelease                      a                                 fabio:PressRelease;
                                              mu:uuid                           ${sparqlEscapeString(id)}.
            OPTIONAL{ ?pressRelease           nie:htmlContent                   ?htmlContent }            
            OPTIONAL{ ?pressRelease           dct:creator                       ?creator }
            OPTIONAL{ ?pressRelease           nie:title                         ?title }
            OPTIONAL{ ?creator                vcard:fn                          ?creatorName }
    }
    `));
    return q.results.bindings.length ? q.results.bindings.map(mapBindingValue)[0] : null;
}
