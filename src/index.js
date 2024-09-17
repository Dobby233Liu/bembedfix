import {
    sendOembed,
    sendTemplate,
    sendError,
    getRequestedURL,
    getMyBaseURL,
    stripTrailingSlashes,
    isUAEndUser,
    doesHTML5EmbedFunctionOnClient,
    shouldNotAddRedirectMetaprop,
    oembedAddExtraMetadata,
    isUserAStupidKidAndTryingToAccessAWordpressApi,
    applySearchParams,
    assert,
} from "./utils.js";
import {
    getRequestedInfo,
    getVideoData,
    loadOembedDataFromQueryString,
} from "./utils_bilibili.js";
import { PROJECT_HOMEPAGE_URL, PROVIDER_NAME } from "./constants.js";

export default async function handler(req, res) {
    let requestedURL = getRequestedURL(req);

    // special routes
    if (isUserAStupidKidAndTryingToAccessAWordpressApi(requestedURL)) {
        res.status(204).send();
        return;
    }
    if (stripTrailingSlashes(requestedURL.pathname) == "/") {
        res.setHeader("Cache-Control", "s-maxage=10800");
        res.redirect(308, PROJECT_HOMEPAGE_URL);
        return;
    }
    if (requestedURL.pathname == "/favicon.ico") {
        res.setHeader("Cache-Control", "s-maxage=86400");
        res.redirect(308, "https://www.bilibili.com/favicon.ico");
        return;
    }

    res.setHeader("Vary", "User-Agent");

    // Videos don't get edited often, so 1 minute TTL is fine ig
    // TODO: s-maxage implies public - is any sensitive info involved in The Process?
    res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate=59");

    let doOembed = false;
    let responseType = "html";
    if (
        stripTrailingSlashes(requestedURL.pathname) == "/oembed" ||
        requestedURL.pathname == "/oembed.json" ||
        requestedURL.pathname == "/oembed.xml"
    ) {
        doOembed = true;
        let isXMLRequested = false;
        if (!requestedURL.pathname.endsWith(".json"))
            isXMLRequested =
                requestedURL.pathname.endsWith(".xml") ||
                req.query.format == "xml";
        responseType = isXMLRequested ? "xml" : "json";
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (req.method == "OPTIONS") return res.status(200).send();
    }

    if (doOembed && !req.query.url) {
        sendOembed(res, loadOembedDataFromQueryString(req.query), responseType);
        return;
    }

    let info, data;
    try {
        info = await getRequestedInfo(
            (!doOembed ? requestedURL : new URL(req.query.url)).pathname,
            requestedURL.searchParams,
        );
    } catch (e) {
        sendError(res, req, "解析请求的 URL 时发生错误", e, responseType);
        return;
    }

    let html5EmbedWorks =
        doesHTML5EmbedFunctionOnClient(req) &&
        !req.query.__bef_disable_html5_embed;

    try {
        switch (info.type) {
            case "video":
                data = await getVideoData(
                    info,
                    !html5EmbedWorks,
                    !req.query.__bef_report_cobalt_errs,
                );
                break;

            default:
                assert(
                    false,
                    "这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。",
                );
                break;
        }
    } catch (e) {
        sendError(
            res,
            req,
            "获取 " + info.type + " 信息时发生错误",
            e,
            responseType,
        );
        return;
    }

    if (doOembed) {
        sendOembed(
            res,
            oembedAddExtraMetadata(data.oembedData, req.query),
            responseType,
        );
        return;
    }

    try {
        if (isUAEndUser(req)) {
            // TODO: For the actual page max-age appears to be 0?
            // DevTools is weird
            res.setHeader(
                "Cache-Control",
                "private, max-age=1, stale-while-revalidate=59",
            );
            // redirect the client to the real video URL
            res.redirect(302, data.url);
            return;
        }

        data.provider = PROVIDER_NAME;
        // FIXME: preferredly do this in some other way or somewhere else
        let oembedJson = applySearchParams(
            new URL("oembed.json", getMyBaseURL(req)),
            data.oembedAPIQueries,
        );
        let oembedXml = applySearchParams(
            new URL("oembed.xml", getMyBaseURL(req)),
            data.oembedAPIQueries,
        );
        data.oembed_json = oembedJson;
        data.oembed_xml = oembedXml;
        data.do_not_add_redirect_metaprop = shouldNotAddRedirectMetaprop(req);

        switch (info.type) {
            case "video":
                data.lie_about_embed_player = !html5EmbedWorks;
                break;
        }

        sendTemplate(res, req, responseType, info.type, data);
    } catch (e) {
        sendError(res, req, "生成 embed 时发生错误", e, responseType);
        return;
    }
}
