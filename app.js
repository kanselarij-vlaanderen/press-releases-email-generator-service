import { app, errorHandler } from 'mu';
import { handleGenericError } from './helpers/generic-helpers';
import {
    getPublicationTasksToPublish,
    saveHtmlContentToPublicationTask,
    pushEmailToOutbox, finalizePublications,
} from './sparql-queries/sparql-queries';
import { createPressReleaseHtml } from './helpers/email-helpers';

app.post('/delta', async (req, res, next) => {
    try {
        const publicationTasksToPublish = await getPublicationTasksToPublish();
        console.log(publicationTasksToPublish);

        // await initializePublications(publicationTasksToPublish);
        res.sendStatus(202);

        for (let pubTask of publicationTasksToPublish) {
            let html = createPressReleaseHtml(pubTask);

            await saveHtmlContentToPublicationTask(pubTask, html);
            await pushEmailToOutbox(pubTask, html);
            await finalizePublications(pubTask)
        }
    } catch (err) {
        return handleGenericError(err, next);
    }
});


// use mu errorHandler middleware.
app.use(errorHandler);
