import { render, renderFile } from "ejs";
import { join as joinPath } from "path";
import { ERROR_TEMPLATE, PROJECT_ISSUES_URL, CRAWLER_UAS } from "./conf.js";
import { Builder as XMLBuilder } from "xml2js";

export function getMyBaseURL(req) {
    const headers = req.headers;
    return new URL(
        `${encodeURI(headers["x-forwarded-proto"] ?? "https")}://`
        + encodeURI(headers["x-vercel-deployment-url"] ?? headers["x-forwarded-host"] ?? headers["host"])
    );
}

export function getRequestedURL(req) {
    return new URL(req.url, getMyBaseURL(req));
}

const xmlBuilder = new XMLBuilder();

export function sendError(res, req, responseType = "html", code, message, data) {
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

export function sendTemplate(res, req, responseType, file, data, errorMessage) {
    renderFile(joinPath(process.cwd(), file), data)
    .catch(function (err) {
        sendError(res, req, responseType, 500, errorMessage, err);
    })
    .then(out => {
        res.setHeader("Content-Type", "text/html");
        res.send(out)
    });
}

export function sendOembed(res, data, type) {
    if (type == "json") {
        res.json(data);
    } else {
        res.setHeader("Content-Type", "text/xml");
        res.send(xmlBuilder.buildObject({ oembed: data }));
    }
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

export function stripTrailingSlashes(str) {
    return /^(\/.*?)(\/*$)/.exec(str)[1];
}

export function isUAEndUser(req) {
    return !CRAWLER_UAS.includes(req.headers["user-agent"]) && !req.query.__bef_tag_debug;
}