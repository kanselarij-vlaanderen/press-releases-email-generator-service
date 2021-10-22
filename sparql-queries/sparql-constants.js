import { sparqlEscapeUri } from 'mu';

export const PREFIXES = `
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
