import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import { getNotStartedPublicationTasks, TASK_ONGOING_STATUS } from './lib/publication-task';
import { VERZENDLIJSTEN_PUBLICATION_CHANNEL } from './config';

/* Accept application/json format from delta-notifier */
app.use(bodyParser.json({
  type: function(req) { return /^application\/json/.test(req.get('content-type')); }
}));

app.post('/delta', async function (req, res, next) {
  const delta = req.body;
  const objects = delta
        .map((changeset) => changeset.inserts)
        .flat()
        .map((triple) => triple.object.value);
  if (objects.find(v => v == VERZENDLIJSTEN_PUBLICATION_CHANNEL)) {
    console.log("Processing deltas for mailing lists...");

    const publicationTasks = await getNotStartedPublicationTasks();

    if (publicationTasks) {
      console.log(`Found ${publicationTasks.length} publication tasks to be processed.`);
      for (const publicationTask of publicationTasks) {
        await publicationTask.persistStatus(TASK_ONGOING_STATUS);
      };
      res.sendStatus(202);
      for (const publicationTask of publicationTasks) {
        await publicationTask.process();
      };
    } else {
      console.log(`No publication tasks found to be processed.`);
      return res.status(200).end();
    }
  } else {
    console.log(`Delta message doesn't contain an insert for mailing lists publication channel`);
    return res.status(200).end();
  }
});

// use mu errorHandler middleware.
app.use(errorHandler);
