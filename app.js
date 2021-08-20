import { app, errorHandler } from 'mu';
import { handleGenericError } from './helpers/generic-helpers';
import {
    getPublicationTasksToPublish,
    saveHtmlContentToPublicationTask,
    pushEmailToOutbox,
    getPressReleaseSources,
    finalizePublications,
    initializePublications,
} from './sparql-queries/sparql-queries';
import { createPressReleaseHtml } from './helpers/email-helpers';

app.post('/delta', async (req, res, next) => {
    let sent = false; // fix for trying to respond with status 500 after 202 is sent
    try {
        const publicationTasksToPublish = await getPublicationTasksToPublish();
        await initializePublications(publicationTasksToPublish);
        res.sendStatus(202);
        sent = true;
        for (let pubTask of publicationTasksToPublish) {
            const sources = await getPressReleaseSources(pubTask);
            let html = createPressReleaseHtml(pubTask, sources);
            await saveHtmlContentToPublicationTask(pubTask, html);
            // await pushEmailToOutbox(pubTask, html);
            // await finalizePublications(pubTask);
        }
    } catch (err) {
        if (!sent) {
            return handleGenericError(err, next);
        } else {
            console.error(err);
        }
    }
});


// use mu errorHandler middleware.
app.use(errorHandler);
