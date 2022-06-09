import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
import { sparqlEscapeUri, sparqlEscapeString, sparqlEscapeDateTime, uuid as generateUuid } from 'mu';
import { VERZENDLIJSTEN_PUBLICATION_CHANNEL, PUBLIC_GRAPH } from '../config';
import { BATCH_SIZE, EMAIL_FROM, EMAIL_TO, OUTBOX_URI } from '../environment';

async function getMailTemplatePath(pressReleaseUri) {
  const result = await query(`
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX fabio: <http://purl.org/spar/fabio/>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

    SELECT ?template WHERE {
      GRAPH ?g {
        <${pressReleaseUri}> a fabio:PressRelease ;
           dct:creator ?organization .
      }
      GRAPH <${PUBLIC_GRAPH}> {
        ?organization ext:mailTemplate ?virtualFile .
        ?template nie:dataSource ?virtualFile .
      }
    } LIMIT 1
  `);

  if (result.results.bindings.length) {
    return result.results.bindings[0]['template'].value.replace('share://', '/share/');
  } else {
    return null;
  }
}

async function getPressReleaseContent(graph, pressReleaseUri) {
  const result = await query(`
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
    PREFIX fabio: <http://purl.org/spar/fabio/>
    PREFIX ebucore: <http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#>
    PREFIX dct: <http://purl.org/dc/terms/>
    PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>

    SELECT ?title ?htmlContent ?startDate ?creatorName ?publicationEvent WHERE {
      GRAPH <${graph}> {
        <${pressReleaseUri}> a fabio:PressRelease ;
          nie:title ?title ;
          nie:htmlContent ?htmlContent ;
          dct:creator ?creator ;
          ebucore:isScheduledOn ?publicationEvent .
        ?publicationEvent a ebucore:PublicationEvent ;
          ebucore:publicationStartDateTime ?startDate .
      }
      GRAPH <${PUBLIC_GRAPH}> {
        OPTIONAL { ?creator vcard:fn ?creatorFullName }
        OPTIONAL { ?creator foaf:name ?creatorShortName }
        BIND(IF(BOUND(?creatorShortName), ?creatorShortName, ?creatorFullName) as ?creatorName)
      }
    } LIMIT 1
  `);

  const binding = result.results.bindings[0];
  const sources = await getPressReleaseSources(graph, pressReleaseUri);

  let pressRelease = {
    uri: pressReleaseUri,
    title: binding['title'].value,
    content: binding['htmlContent'].value,
    publicationDate: binding['startDate'].value,
    creatorName: binding['creatorName'] ? binding['creatorName'].value: null,
    publicationEvent: binding['publicationEvent'].value,
    sources: sources
  };
  return pressRelease;
}

async function getPressReleaseSources(graph, pressReleaseUri) {
  const result = await query(`
      PREFIX fabio: <http://purl.org/spar/fabio/>
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX ebucore: <http://www.ebu.ch/metadata/ontologies/ebucore/ebucore#>
      PREFIX vcard: <http://www.w3.org/2006/vcard/ns#>
      PREFIX org: <http://www.w3.org/ns/org#>
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>

      SELECT ?source ?fullName ?function ?telephone ?mobile ?email ?organization WHERE {
        GRAPH <${graph}> {
          <${pressReleaseUri}> a fabio:PressRelease;
            dct:source ?source .
          ?source a ebucore:Contact ;
            vcard:fn ?fullName .
          OPTIONAL { ?source vcard:role ?function }
          OPTIONAL {
              ?source vcard:hasTelephone ?telephoneURI .
              ?telephoneURI a vcard:Voice ;
                vcard:hasValue ?telephone ;
                ext:publicationChannel <${VERZENDLIJSTEN_PUBLICATION_CHANNEL}> .
          }
          OPTIONAL {
              ?source ext:hasMobile ?mobileURI .
              ?mobileURI a vcard:Cell;
                vcard:hasValue ?mobile;
                ext:publicationChannel <${VERZENDLIJSTEN_PUBLICATION_CHANNEL}> .
          }
          OPTIONAL {
              ?source vcard:hasEmail ?emailURI .
              ?emailURI a vcard:Email ;
                vcard:hasValue ?email ;
                ext:publicationChannel <${VERZENDLIJSTEN_PUBLICATION_CHANNEL}> .
          }
        }
        OPTIONAL{
          GRAPH <${PUBLIC_GRAPH}> {
            ?organizationURI a vcard:Organization ;
               vcard:fn ?organization  .
          }
          GRAPH <${graph}> {
            ?organizationURI  org:hasMember ?source .
          }
        }
      }
  `);

  return result.results.bindings.map(mapBindingValue);

}

async function getPressReleaseAttachments(graph, pressReleaseUri) {
  // example attachment query string
  // nmo:hasAttachment <http://mu.semte.ch/services/file-service/files/602fa6c6424d81000d000000> ;

  const attachmentsQuery = await query(`
    PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>

    SELECT ?attachment WHERE {
      GRAPH <${graph}> {
        <${pressReleaseUri}> nie:hasPart ?attachment.
      }
    }
  `);

  return attachmentsQuery.results.bindings.map(mapBindingValue).map((item) => item.attachment);
}


async function savePressReleaseText(graph, taskUri, htmlContent) {
  await update(`
      PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
      PREFIX nie: <http://www.semanticdesktop.org/ontologies/2007/01/19/nie#>
      PREFIX dct: <http://purl.org/dc/terms/>

      INSERT {
        GRAPH <${graph}> {
          <${taskUri}> nie:htmlContent ${sparqlEscapeString(htmlContent)} ;
            dct:modified ${sparqlEscapeDateTime(new Date())} .
        }
      } WHERE {
        GRAPH <${graph}> {
          <${taskUri}> a ext:PublicationTask .
        }
      }
    `);
}

async function createRecipientBatches(graph, publicationEventUri) {
  const q = await query(`
    PREFIX ext: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/ext/')}
    PREFIX nco: ${sparqlEscapeUri('http://www.semanticdesktop.org/ontologies/2007/03/22/nco#')}
    PREFIX vcard: ${sparqlEscapeUri('http://www.w3.org/2006/vcard/ns#')}

    SELECT DISTINCT ?value WHERE {
      GRAPH <${graph}> {
        {
          ?contactList ext:contactListHasChannelPublicationEvent ${sparqlEscapeUri(publicationEventUri)} ;
            nco:containsContact ?contactListItem .
            ?contactListItem  vcard:hasEmail ?email.
            ?email vcard:hasValue ?value.
        }
        UNION {
          ?contactItem ext:contactHasChannelPublicationEvent ${sparqlEscapeUri(publicationEventUri)};
          vcard:hasEmail ?email .
          ?email vcard:hasValue ?value.
        }
      }
    }
  `);

  // map array of email values
  const emails = q.results.bindings.map(mapBindingValue).map(item => item.value);

  // split the array into batches and return
  return splitArrayIntoBatches(emails, BATCH_SIZE);

}

async function prepareEmail(pressRelease, batchQuery, attachmentsQuery, now) {
  const uuid = generateUuid();
  await update(`
    PREFIX mu: ${sparqlEscapeUri('http://mu.semte.ch/vocabularies/core/')}
    PREFIX nmo: ${sparqlEscapeUri('http://www.semanticdesktop.org/ontologies/2007/03/22/nmo#')}

    INSERT DATA {
      GRAPH <http://mu.semte.ch/graphs/system/email> {
        <http://themis.vlaanderen.be/id/emails/${uuid}> a nmo:Email;
          mu:uuid <${uuid}>;
          nmo:emailTo ${sparqlEscapeString(EMAIL_TO)};
          ${batchQuery}
          nmo:messageFrom ${sparqlEscapeString(EMAIL_FROM)};
          nmo:messageSubject ${sparqlEscapeString(pressRelease.title)};
          nmo:htmlMessageContent ${sparqlEscapeString(pressRelease.htmlContent)};
          nmo:sentDate ${sparqlEscapeDateTime(now)};
          ${attachmentsQuery}
          nmo:isPartOf ${sparqlEscapeUri(OUTBOX_URI)}.
      }
    }
 `);
}

function mapBindingValue(binding) {
  const result = {};
  for (let key in binding) {
      result[key] = binding[key].value;
  }
  return result;
}

function splitArrayIntoBatches(input, batchSize) {
  return input.reduce((resultArray, item, index) => {

      const chunkIndex = Math.floor(index / batchSize);

      if (!resultArray[chunkIndex]) {
          resultArray[chunkIndex] = []; // start a new chunk
      }

      resultArray[chunkIndex].push(item);

      return resultArray;
  }, []);
}

export {
  getMailTemplatePath,
  getPressReleaseContent,
  savePressReleaseText,
  getPressReleaseAttachments,
  createRecipientBatches,
  prepareEmail
};
