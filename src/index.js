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
    isUserAStupidKidAndTryingToAccessAWordpressApi
} from "./utils.js";
import {
    getRequestedInfo,
    getVideoData,
    loadOembedDataFromQuerystring,
} from "./utils_bilibili.js";
import { PROJECT_URL, PROVIDER_NAME } from "./constants.js";

export default async function handler(req, res) {
    let requestedURL = getRequestedURL(req);

    // special routes
    if (isUserAStupidKidAndTryingToAccessAWordpressApi(requestedURL)) {
        res.status(400).send();
        return;
    }
    if (stripTrailingSlashes(requestedURL.pathname) == "/") {
        res.setHeader("Cache-Control", "max-age=10800, s-maxage=10800");
        res.redirect(308, PROJECT_URL);
        return;
    }
    if (requestedURL.pathname == "/favicon.ico") {
        res.setHeader("Cache-Control", "max-age=86400, s-maxage=86400");
        res.redirect(308, "https://www.bilibili.com/favicon.ico");
        return;
    }

    res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate");

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
    }

    if (doOembed && !req.query.url) {
        sendOembed(res, loadOembedDataFromQuerystring(req.query), responseType);
        return;
    }

    let info, data;
    try {
        info = await getRequestedInfo(
            (!doOembed ? requestedURL : new URL(req.query.url)).pathname,
            requestedURL.searchParams
        );
    } catch (e) {
        sendError(res, req, "解析请求的 URL 时发生错误", e, responseType);
        return;
    }

    let html5EmbedWorks = doesHTML5EmbedFunctionOnClient(req) && !req.query.__bef_disable_html5_embed;
    try {
        // TODO: Uncommenting the following enables interaction with the Cobalt API
        data = await getVideoData(info); // , !html5EmbedWorks, !req.query.__bef_report_cobalt_errs);
    } catch (e) {
        sendError(res, req, "获取视频信息时发生错误", e, responseType);
        return;
    }

    if (doOembed) {
        sendOembed(
            res,
            oembedAddExtraMetadata(data.oembedData, req.query),
            responseType
        );
        return;
    }

    try {
        if (isUAEndUser(req)) {
            res.setHeader(
                "Cache-Control",
                "private, max-age=1, stale-while-revalidate"
            );
            // redirect the client to the real video URL
            res.redirect(302, data.url);
            return;
        }

        data.provider = PROVIDER_NAME;
        // FIXME: preferredly do this in some other way or somewhere else
        let oembedJson = new URL("oembed.json", getMyBaseURL(req));
        let oembedXml = new URL("oembed.xml", getMyBaseURL(req));
        for (let [k, v] of Object.entries(data.oembedAPIQueries)) {
            if (v == null) continue;
            oembedJson.searchParams.set(k, v);
            oembedXml.searchParams.set(k, v);
        }
        data.oembed_json = oembedJson;
        data.oembed_xml = oembedXml;
        data.lie_about_embed_player = !html5EmbedWorks;
        data.do_not_add_redirect_metaprop = shouldNotAddRedirectMetaprop(req);

        sendTemplate(res, req, responseType, "video", data);
    } catch (e) {
        sendError(res, req, "生成 embed 时发生错误", e, responseType);
        return;
    }
}
