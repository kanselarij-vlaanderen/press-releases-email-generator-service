import Handlebars from 'handlebars';
import path from 'path';
import { readFileSync } from 'fs';

export function createPressReleaseHtml(publicationTask, sources) {
    // Open template file
    const templateSource = readFileSync(path.join(__dirname.replace('helpers','templates'), '/email.hbs'), 'utf8');
    Handlebars.registerHelper('isdefined', function (value) {
        return value !== undefined;
    });
    // Create email generator
    const template = Handlebars.compile(templateSource);

    const {title, htmlContent} = publicationTask;
    // generate and return html with variables
    return template({title, htmlContent, sources});
}
