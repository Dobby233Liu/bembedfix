import { sendOembed, sendTemplate, sendError, getRequestedURL, getMyBaseURL, stripTrailingSlashes, isUAEndUser, shouldLieAboutPlayerContentType, oembedAddExtraMetadata } from "./utils.js";
import { getRequestedInfo, getVideoData, loadOembedDataFromQuerystring } from "./utils_bilibili.js";
import { PROJECT_URL, PROVIDER_NAME } from "./conf.js";

export default function handler(req, res) {
    let requestedURL = getRequestedURL(req);

    // special routes
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
    if (stripTrailingSlashes(requestedURL.pathname) == "/oembed" || requestedURL.pathname == "/oembed.json" || requestedURL.pathname == "/oembed.xml") {
        doOembed = true;
        let isXMLRequested = false;
        if (!requestedURL.pathname.endsWith(".json"))
            isXMLRequested = requestedURL.pathname.endsWith(".xml") || req.query.format == "xml";
        responseType = isXMLRequested ? "xml" : "json";
    }

    if (!doOembed || req.query.url) {
        getRequestedInfo((!doOembed ? requestedURL : new URL(req.query.url)).pathname, requestedURL.searchParams)
        .then(info => {
            getVideoData(info)
            .then(data => {
                if (!doOembed) {
                    if (isUAEndUser(req)) {
                        res.setHeader("Cache-Control", "private, max-age=1, stale-while-revalidate");
                        // redirect the client to the real video URL
                        res.redirect(302, data.url.href);
                        return;
                    }

                    data.provider = PROVIDER_NAME;
                    // FIXME: preferredly do this in some other way or somewhere else
                    let oembedJson = new URL("oembed.json", getMyBaseURL(req));
                    let oembedXml = new URL("oembed.xml", getMyBaseURL(req));
                    for (let [k, v] of Object.entries(data.oembed_query)) {
                        oembedJson.searchParams.set(k, v);
                        oembedXml.searchParams.set(k, v);
                    }
                    data.oembed_json = oembedJson;
                    data.oembed_xml = oembedXml;
                    data.lie_about_embed_player = shouldLieAboutPlayerContentType(req);

                    sendTemplate(res, req, responseType, "template.html", data, "生成 embed 时发生错误")
                } else {
                    sendOembed(res, oembedAddExtraMetadata(data.oembed_out, req.query), responseType);
                }
            })
            .catch(e => {
                sendError(res, req, responseType, e ? e.httpError ?? 500 : 500, "获取视频信息时发生错误", e);
            });
        })
        .catch(e => {
            sendError(res, req, responseType, e ? e.httpError ?? 500 : 500, "解析请求的 URL 时发生错误", e);
        });
    } else if (doOembed) {
        sendOembed(res, loadOembedDataFromQuerystring(req.query), responseType);
    }
}
