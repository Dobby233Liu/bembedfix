import { sendOembed, sendTemplate, sendError, getRequestedURL, getMyBaseURL, stripTrailingSlashes, isUAEndUser, shouldLieAboutPlayerContentType } from "./utils.js";
import { getRequestedInfo, getVideoData, getOembedData } from "./utils_bilibili.js";
import { PROJECT_URL, PROVIDER_NAME } from "./conf.js";

export default function handler(req, res) {
    let requestedURL = getRequestedURL(req);

    // special routes
    switch (requestedURL.pathname) {
        case "/":
            res.redirect(301, PROJECT_URL);
            return;
        case "/favicon.ico":
            res.setHeader("Cache-Control", "max-age=86400, s-maxage=86400");
            res.redirect(301, "https://www.bilibili.com/favicon.ico");
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

                    // FIXME: preferredly do this in some other way or somewhere else
                    data.oembed = new URL("oembed", getMyBaseURL(req)).href;
                    data.provider = PROVIDER_NAME;
                    data.lie_about_embed_player = shouldLieAboutPlayerContentType(req);

                    sendTemplate(res, req, responseType, "template.html", data, "生成 embed 时发生错误")
                } else {
                    sendOembed(res, getOembedData({
                        type: "video",
                        bvid: data.bvid,
                        pic: data.thumbnail,
                        author: data.author,
                        mid: data.author_mid,
                        maxwidth: req.query.maxwidth,
                        maxheight: req.query.maxheight,
                        cid: data.cid,
                        page: data.page,
                    }), responseType);
                }
            })
            .catch(e => {
                sendError(res, req, responseType, 500, "获取视频信息时发生错误", e);
            });
        })
        .catch(e => {
            sendError(res, req, responseType, 500, "解析请求的 URL 时发生错误", e);
        });
    } else if (doOembed) {
        if (!req.query.bvid) {
            sendError(res, req, responseType, 400, "请求无效", "没有提供应有的参数");
            return;
        }

        sendOembed(res, getOembedData(req.query), responseType);
    }
}
