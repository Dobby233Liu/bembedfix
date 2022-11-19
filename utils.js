import { render, renderFile } from "ejs";
import { join as joinPath } from "path";
import { ERROR_TEMPLATE, PROJECT_ISSUES_URL } from "./conf.js";
import { Builder as XMLBuilder } from "xml2js";

export function getRequestedURL(req) {
    return new URL(req.url, "https://" + req.headers.host);
}

export function sendError(res, code, message, data, req) {
    res.status(code)
    .send(render(ERROR_TEMPLATE,
        {
            code: code,
            message: message,
            data: data.stack ? data.stack : data.toString(),
            here: getRequestedURL(req).href,
            issues_url: PROJECT_ISSUES_URL
        }
    ));
}

export function sendTemplate(res, file, data, errorMessage, req) {
    renderFile(joinPath(process.cwd(), file), data)
    .catch(function (err) {
        sendError(res, 500, errorMessage, err, req);
    })
    .then(out => res.send(out));
}

export function sendOembed(data, res, isXML) {
    if (!isXML) {
        res.json(data);
        return;
    }

    res.setHeader("Content-Type", "text/xml");
    res.send(new XMLBuilder().buildObject({ oembed: data }));
}

export function checkIfUrlIsUnderDomain(l, r) {
    let levelsOfDomainLeft = l.split(".");
    let levelsOfDomainRight = r.split(".");
    if (levelsOfDomainLeft.length < levelsOfDomainRight.length)
        return false;
    return levelsOfDomainLeft
        .slice(-levelsOfDomainRight.length)
        .every((level, index) => level == levelsOfDomainRight[index]);
}
