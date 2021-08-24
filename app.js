import { app, errorHandler } from 'mu';
import { handleGenericError } from './helpers/generic-helpers';
import {
    getPublicationTasksToPublish,
    saveHtmlContentToPublicationTask,
    pushEmailToOutbox,
    getPressReleaseSources,
    finalizePublications,
    initializePublications, failPublications, getPressReleaseAttachments,
} from './sparql-queries/sparql-queries';
import { createPressReleaseHtml } from './helpers/email-helpers';

app.post('/delta', async (req, res, next) => {
    let publicationTasksToPublish;
    try {
        publicationTasksToPublish = await getPublicationTasksToPublish();
        console.log(`Found ${publicationTasksToPublish.length} publication tasks with emails to be generated and sent.`);
        await initializePublications(publicationTasksToPublish);
        res.sendStatus(202);
        for (let pubTask of publicationTasksToPublish) {
            const sources = await getPressReleaseSources(pubTask);
            const attachments = await getPressReleaseAttachments(pubTask);
            const html = createPressReleaseHtml(pubTask, sources);
            await saveHtmlContentToPublicationTask(pubTask, html);
            await pushEmailToOutbox(pubTask, html, attachments);
            await finalizePublications(pubTask);
        }
    } catch (err) {
        for (let pt of publicationTasksToPublish) {
            await failPublications(pt);
        }

        try {
            return handleGenericError(err, next);
        } catch (e) {
            console.error(err, e);
        }
    }
});


// use mu errorHandler middleware.
app.use(errorHandler);

