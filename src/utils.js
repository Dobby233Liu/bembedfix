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
        throw new Error("断言失败" + (msg ? `：${msg}` : ""));
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

/**
 * @param {string} subdomain
 * @param {string} domain
 */
export function checkDomainIsSubdomainOf(subdomain, domain) {
    let leftLevels = subdomain.split(".").reverse();
    let rightLevels = domain.split(".").reverse();
    if (leftLevels.length < rightLevels.length) return false;
    return leftLevels
        .slice(0, rightLevels.length)
        .every((l, i) => l === rightLevels[i]);
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

export function isUserDiscordbot(req) {
    return req.headers["user-agent"].includes("Discordbot");
}

export function doesHTML5EmbedFunctionOnClient(req) {
    return !isUserDiscordbot(req);
}

export function shouldNotAddRedirectMetaprop(req) {
    return (
        req.headers["user-agent"].includes("Schema-Markup-Validator") ||
        req.query.__bef_tag_debug
    );
}

export function shortenDescription(
    desc = "",
    length = 160,
    substNewlines = true,
) {
    const elipsis = "……";
    let ret = desc;
    if (substNewlines) ret = ret.replace(/\r\n/g, "").replace(/\n/g, "");
    ret = ret.trim();
    if (ret.length > length) {
        return ret.slice(0, length - elipsis.length) + elipsis;
    }
    return ret;
}

const TEMPLATE_MINIFY_OPTIONS = {
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
    // We kinda have to pretend it was successful for Discord
    res.status(!isUserDiscordbot(req) ? code : 200);

    const errorData = {
        code: code,
        message: message,
        data: data.stack
            ? data.stack
            : data.toString() == "[object Object]"
              ? JSON.stringify(data)
              : data,
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
                    me: MY_NAME,
                    issues_url: PROJECT_ISSUES_URL,
                    dataShort: shortenDescription(errorData.data, 240, false),
                    here: getRequestedURL(req).href,
                }),
                TEMPLATE_MINIFY_OPTIONS,
            ).then((out) => {
                res.send(out);
            });
            break;
    }
}

export function sendTemplate(res, req, responseType, file, data) {
    renderFile(joinPath(process.cwd(), `src/templates/${file}.html`), data)
        .catch(function (err) {
            sendError(res, req, "生成 embed 时发生错误", err, responseType);
        })
        .then((out) => minify(out, TEMPLATE_MINIFY_OPTIONS))
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

    switch (ret.type) {
        case "video":
            // The embed player probably honors it, so don't bother that much
            ret.width = query.maxwidth
                ? Math.min(+query.maxwidth, ret.width)
                : ret.width;
            ret.height = query.maxheight
                ? Math.min(+query.maxheight, ret.height)
                : ret.height;
            break;

        default:
            assert(false, "未知 OEmbed 对象类型 " + ret.type);
            break;
    }

    return ret;
}

export async function obtainVideoStreamFromCobalt(videoPageURL, page = 1) {
    if (!COBALT_API_INSTANCE)
        throw new Error(
            "Cobalt intergration is not enabled (COBALT_API_INSTANCE is not set)",
        );

    let cobaltRepRaw;
    let cobaltReqBody = {
        url: videoPageURL,
        disableMetadata: true,
    };
    if (COBALT_API_VERSION == 10) {
        cobaltReqBody = {
            ...cobaltReqBody,
            videoQuality: "720",
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
    let cobaltRepParsed;
    try {
        cobaltRepParsed = JSON.parse(cobaltRepRaw);
    } catch (e) {
        e;
        throw cobaltRepRaw;
    }
    if (
        !cobaltRep.ok ||
        cobaltRepParsed.status == "error" ||
        COBALT_API_VERSION == 7
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

// This lets nullish operators work
export function parseIntSafe(value, radix) {
    let ret = parseInt(value, radix);
    if (isNaN(ret)) return null;
    return ret;
}

export function applySearchParams(url, newParams) {
    if (!newParams) return url;
    // I hate my job
    for (const [k, v] of newParams instanceof URLSearchParams
        ? newParams.entries()
        : Object.entries(newParams)) {
        if (v === null || v === undefined) continue;
        url.searchParams.set(k, v);
    }
    return url;
}
