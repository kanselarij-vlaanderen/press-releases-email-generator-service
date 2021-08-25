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
                throw err;
            }
        }
    } catch (err) {
        try {
            return handleGenericError(err, next);
        } catch (e) {
            console.error(err, e);
        }
    }
});

// use mu errorHandler middleware.
app.use(errorHandler);
