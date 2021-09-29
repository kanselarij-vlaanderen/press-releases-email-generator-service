import Handlebars from 'handlebars';
import path from 'path';
import { minify } from 'html-minifier';
import { readFileSync } from 'fs';

export function createPressReleaseHtml(content, sources) {
    // Open template file
    const templateSource = readFileSync(path.join(__dirname.replace('helpers', 'templates'), '/email.hbs'), 'utf8');
    Handlebars.registerHelper('isdefined', function (value) {
        return value !== undefined;
    });
    // Create email generator
    const template = Handlebars.compile(templateSource);

    // generate and return html with variables
    const html = template({...content, sources});
    // return minified html
    return minify(html, {
        removeComments: true,
        collapseWhitespace: true,
        removeEmptyAttributes: true,
    });
}




