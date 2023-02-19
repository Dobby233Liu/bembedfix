import { render, renderFile } from "ejs";
import { join as joinPath } from "path";
import { Builder as XMLBuilder } from "xml2js";
import { PROVIDER_NAME, PROVIDER_URL, ERROR_TEMPLATE, PROJECT_ISSUES_URL, CRAWLER_UAS } from "./conf.js";

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;

const xmlBuilder = new XMLBuilder();

export function assert(cond, msg = "") {
    if (!cond) {
        throw new Error("断言失败" + msg ? `：${msg}` : "")
    }
}

export function getRequestedURL(req) {
    return new URL(req.url, getMyBaseURL(req));
}

export function getMyBaseURL(req) {
    const headers = req.headers;
    return new URL(
        `${encodeURI(headers["x-forwarded-proto"] ?? "https")}://`
        + encodeURI(headers["x-vercel-deployment-url"] ?? headers["x-forwarded-host"] ?? headers["host"])
    );
}

export function checkIfURLIsUnderDomain(l, r) {
    let levelsOfDomainLeft = l.split(".");
    let levelsOfDomainRight = r.split(".");
    if (levelsOfDomainLeft.length < levelsOfDomainRight.length)
        return false;
    return levelsOfDomainLeft
        .slice(-levelsOfDomainRight.length)
        .every((level, index) => level == levelsOfDomainRight[index]);
}

export function stripTrailingSlashes(path) {
    return /^(\/.*?)(\/*$)/.exec(path)[1];
}

export function isUAEndUser(req) {
    return !CRAWLER_UAS.includes(req.headers["user-agent"]) && !req.query.__bef_tag_debug;
}

export function shouldLieAboutPlayerContentType(req) {
    return req.headers["user-agent"].includes("Discordbot");
}

export function getCompatDescription(desc = "", length = 160) {
    const elipsis = "……";
    let ret = desc;
    ret = ret.replace(/\r\n/g, "").replace(/\n/g, "").trim();
    if (ret.length > length) {
        return ret.slice(0, length - elipsis.length) + elipsis;
    }
    return ret;
}

export function sendError(res, req, responseType = "html", code = 500, message = "未知错误", data = "未知错误。") {
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
        res.send(out);
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

export function oembedAddExtraMetadata(data, query = {}) {
    let ret = {
        version: "1.0",
        ...data,
        provider_name: PROVIDER_NAME,
        provider_url: PROVIDER_URL
    };
    assert(ret.type == "video");
    ret.width = query.maxwidth ? Math.min(+query.maxwidth, ret.width) : ret.width;
    ret.height = query.maxheight ? Math.min(+query.maxheight, ret.height) : ret.height;
    return ret;
}