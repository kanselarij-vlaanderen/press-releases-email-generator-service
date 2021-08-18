import Handlebars from 'handlebars';
import path from 'path';
import { readFileSync } from 'fs';

export function createPressReleaseHtml(publicationTask) {
    // Open template file
    const source = readFileSync(path.join(__dirname.replace('helpers','templates'), '/email.hbs'), 'utf8');
    // Create email generator
    const template = Handlebars.compile(source);

    const {title, htmlContent} = publicationTask;
    // generate and return html with variables
    return template({title, htmlContent});
}
