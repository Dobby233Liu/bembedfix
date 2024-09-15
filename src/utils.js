import { render, renderFile } from "ejs";
import { join as joinPath } from "path";
import { Builder as XMLBuilder } from "xml2js";
import { minify } from "html-minifier-terser";
import {
    PROVIDER_NAME,
    PROVIDER_URL,
    ERROR_TEMPLATE,
    PROJECT_ISSUES_URL,
    CRAWLER_UAS,
    MY_NAME,
    COBALT_API_INSTANCE,
    COBALT_API_VERSION,
} from "./constants.js";

export const DEFAULT_WIDTH = 1280;
export const DEFAULT_HEIGHT = 720;

const xmlBuilder = new XMLBuilder({ renderOpts: { pretty: false } });

export function assert(cond, msg = "") {
    if (!cond) {
        throw new Error("断言失败" + msg ? `：${msg}` : "");
    }
}

export function getRequestedURL(req) {
    return new URL(req.url, getMyBaseURL(req));
}

export function getMyBaseURL(req) {
    const headers = req.headers;
    return new URL(
        `${encodeURI(headers["x-forwarded-proto"] ?? "https")}://` +
            encodeURI(
                headers["x-vercel-deployment-url"] ??
                    headers["x-forwarded-host"] ??
                    headers["host"],
            ),
    );
}

export function checkIfURLIsUnderDomain(l, r) {
    let levelsOfDomainLeft = l.split(".");
    let levelsOfDomainRight = r.split(".");
    if (levelsOfDomainLeft.length < levelsOfDomainRight.length) return false;
    return levelsOfDomainLeft
        .slice(-levelsOfDomainRight.length)
        .every((level, index) => level == levelsOfDomainRight[index]);
}

export function stripTrailingSlashes(path) {
    return path.replace(/\/+/g, "/").replace(/(?!^)\/+$/, "");
}

export function isUserAStupidKidAndTryingToAccessAWordpressApi(url) {
    return /wp-(admin|content)|.php/.test(url.pathname);
}

export function isUAEndUser(req) {
    return (
        !CRAWLER_UAS.includes(req.headers["user-agent"]) &&
        !req.query.__bef_tag_debug
    );
}

export function doesHTML5EmbedFunctionOnClient(req) {
    return !req.headers["user-agent"].includes("Discordbot");
}

export function shouldNotAddRedirectMetaprop(req) {
    return (
        req.headers["user-agent"].includes("Schema-Markup-Validator") ||
        req.query.__bef_tag_debug
    );
}

export function getCompatDescription(desc = "", length = 160) {
    const elipsis = "……";
    let ret = desc.replace(/\r\n/g, "").replace(/\n/g, "").trim();
    if (ret.length > length) {
        return ret.slice(0, length - elipsis.length) + elipsis;
    }
    return ret;
}

const MINIFY_OPTIONS = {
    decodeEntities: true,
    collapseWhitespace: true,
    removeComments: true,
};

export function sendError(
    res,
    req,
    message = "未知错误",
    data = "未知错误。",
    responseType = "html",
    code = data ? (data.httpError ?? 500) : 500,
) {
    res.status(code);

    const errorData = {
        me: MY_NAME,
        code: code,
        message: message,
        data: data.stack
            ? data.stack
            : data.toString() == "[object Object]"
              ? JSON.stringify(data)
              : data,
        issues_url: PROJECT_ISSUES_URL,
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
            // FIXME: If this fails... good luck
            minify(
                render(ERROR_TEMPLATE, {
                    ...errorData,
                    here: getRequestedURL(req).href,
                }),
                MINIFY_OPTIONS,
            ).then((out) => {
                res.send(out);
            });
            break;
    }
}

export function sendTemplate(res, req, responseType, file = "video", data) {
    renderFile(joinPath(process.cwd(), `src/templates/${file}.html`), data)
        .catch(function (err) {
            sendError(res, req, "生成 embed 时发生错误", err, responseType);
        })
        .then((out) => minify(out, MINIFY_OPTIONS))
        .then((out) => {
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
        provider_url: PROVIDER_URL,
    };
    assert(ret.type == "video");
    // The embed player probably honors it, so don't bother that much
    ret.width = query.maxwidth
        ? Math.min(+query.maxwidth, ret.width)
        : ret.width;
    ret.height = query.maxheight
        ? Math.min(+query.maxheight, ret.height)
        : ret.height;
    return ret;
}

export async function obtainVideoStreamFromCobalt(videoPageURL, page = 1) {
    let cobaltRepRaw;
    let cobaltReqBody = {
        url: videoPageURL,
        disableMetadata: true,
    };
    if (COBALT_API_VERSION == 10) {
        cobaltReqBody = {
            ...cobaltReqBody,
            videoQuality: 720,
        };
    } else {
        cobaltReqBody = {
            ...cobaltReqBody,
            vQuality: 720,
        };
    }
    const cobaltRep = await fetch(
        new URL(
            COBALT_API_VERSION == 10 ? "/" : "/api/json",
            COBALT_API_INSTANCE,
        ).href,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(cobaltReqBody),
            // FIXME
            // signal: AbortSignal.timeout(3000)
        },
    );
    cobaltRepRaw = await cobaltRep.text();
    if (!cobaltRep.ok) {
        throw cobaltRepRaw;
    }
    let cobaltRepParsed = JSON.parse(cobaltRepRaw);
    if (
        cobaltRepParsed.status == "error" || COBALT_API_VERSION == 7
            ? cobaltRepParsed.status == "rate-limit"
            : false
    ) {
        throw cobaltRepParsed;
    } else if (cobaltRepParsed.status != "picker") {
        // redirect, tunnel (10)
        return cobaltRepParsed.url;
    } else {
        if (COBALT_API_VERSION == 7)
            assert(cobaltRepParsed.pickerType == "various");
        assert(cobaltRepParsed.picker.length > 0);
        const item = cobaltRepParsed.picker[page - 1]
            ? cobaltRepParsed.picker[page - 1]
            : cobaltRepParsed.picker[0];
        if (COBALT_API_VERSION == 10) assert(item.type == "video");
        return item.url;
    }
}
