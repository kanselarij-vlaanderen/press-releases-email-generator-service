import { querySudo as query } from '@lblod/mu-auth-sudo';
import { mapBindingValue } from '../helpers/generic-helpers';
import { sparqlEscapeUri } from 'mu';
import { PREFIXES, VERZENDLIJSTEN_PUBLICATION_CHANNEL } from './sparql-constants';

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
