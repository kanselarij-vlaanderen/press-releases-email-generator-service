import { app, errorHandler } from 'mu';
import { handleGenericError } from './helpers/generic-helpers';
import { createPressReleaseHtml } from './helpers/email-helpers';
import { getPressReleaseAttachments } from './sparql-queries/attachments.sparql-queries';
import {
    failPublication,
    finalizePublication,
    getPublicationTasksToPublish,
    initializePublications,
    saveHtmlContentToPublicationTask,
} from './sparql-queries/publication-task.sparql-queries';
import { getPressReleaseSources } from './sparql-queries/press-release.sparql-queries';
import { pushEmailToOutbox } from './sparql-queries/email.sparql-queries';
import { getPressReleaseById, getRelatedSources } from './sparql-queries/press-release-template.sparql-queries';
import { COLLABORATOR_GRAPH_PREFIX } from './sparql-queries/sparql-constants';

app.post('/delta', async (req, res, next) => {
    try {
        const publicationTasksToPublish = await getPublicationTasksToPublish();
        console.log(`Found ${publicationTasksToPublish.length} publication tasks with emails to be generated and sent.`);
        await initializePublications(publicationTasksToPublish);
        res.sendStatus(202);
        for (let pubTask of publicationTasksToPublish) {
            try {
                const sources = await getPressReleaseSources(pubTask);
                const attachments = await getPressReleaseAttachments(pubTask);
                const html = createPressReleaseHtml(pubTask, sources);
                await saveHtmlContentToPublicationTask(pubTask, html);
                await pushEmailToOutbox(pubTask, html, attachments);
                await finalizePublication(pubTask);
            } catch (err) {
                await failPublication(pubTask);
                console.log(`Something went wrong while processing the publication task.`);
                console.log(err);
            }
        }
    } catch (err) {
        return handleGenericError(err, next);
    }
});

app.get('/press-releases/:id/preview', async (req, res, next) => {
    try {
        const pressReleaseId = req.params.id;
        const pressRelease = await getPressReleaseById(pressReleaseId);
        pressRelease.graph = `${COLLABORATOR_GRAPH_PREFIX}${pressReleaseId}`;
        if (!pressRelease) {
            return res.sendStatus(404);
        }
        const sources = await getPressReleaseSources(pressRelease);
        const html = createPressReleaseHtml(pressRelease, sources);
        return res.status(200).send(html);
    } catch (err) {
        return handleGenericError(err, next);
    }
});

// use mu errorHandler middleware.
app.use(errorHandler);
