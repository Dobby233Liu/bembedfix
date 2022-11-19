import { render, renderFile } from "ejs";
import { join as joinPath } from "path";
import { ERROR_TEMPLATE, PROJECT_ISSUES_URL } from "./conf.js";
import { Builder as XMLBuilder } from "xml2js";

export function getRequestedURL(req) {
    return new URL(req.url, "https://" + req.headers.host);
}

const xmlBuilder = new XMLBuilder();

export function sendError(res, code, message, data, req, responseType = "html") {
    res.status(code);

    const errorData = {
        code: code,
        message: message,
        data: data.stack ? data.stack : data.toString(),
        issues_url: PROJECT_ISSUES_URL
    };

    switch (responseType) {
        case "json":
            res.json(errorData);
            break;
        case "xml":
            res.setHeader("Content-Type", "text/xml");
            res.send(xmlBuilder.buildObject({ bembedfix_error: errorData }));
            break;
        default:
            res.send(render(ERROR_TEMPLATE, {
                ...errorData,
                here: getRequestedURL(req).href,
            }));
            break;
    }
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
    res.send(xmlBuilder.buildObject({ oembed: data }));
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
