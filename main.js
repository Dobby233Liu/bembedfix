import { sendOembed, sendTemplate, sendError, getRequestedURL } from "./utils.js";
import { getVideoIdByPathSmart, getVideoData, getOembedData } from "./utils_bilibili.js";
import { PROJECT_URL, PROVIDER_NAME, CRAWLER_UAS } from "./conf.js";

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

    if (requestedURL.pathname == "/oembed" || requestedURL.pathname == "/oembed.json" || requestedURL.pathname == "/oembed.xml") {
        const isXMLRequested = requestedURL.pathname.endsWith(".xml")
            || (!requestedURL.pathname.endsWith(".json") && req.query.format == "xml");
        const errorResType = isXMLRequested ? "xml" : "json";

        if (req.query.url) {
            // user requested with a URL, grab video info
            getVideoIdByPathSmart(new URL(req.query.url).pathname)
            .then(id => {
                getVideoData(id)
                .then(data => {
                    sendOembed(getOembedData({
                        type: "video",
                        bvid: data.bvid,
                        pic: data.thumbnail,
                        author: data.author,
                        mid: data.author_mid,
                        maxwidth: req.query.maxwidth,
                        maxheight: req.query.maxheight,
                    }), res, isXMLRequested);
                })
                .catch(e => {
                    sendError(res, 500, "获取视频信息时发生错误", e, req, errorResType);
                });
            })
            .catch(e => {
                sendError(res, 500, "解析请求的 URL 时发生错误", e, req, errorResType);
            });

            return;
        } else if (!req.query.bvid) {
            sendError(res, 400, "请求无效。Bad request", "没有提供应有的参数。Did not provide required parameters.", req, errorResType);
            return;
        }

        sendOembed(getOembedData(req.query), res, isXMLRequested);
        return;
    }

    getVideoIdByPathSmart(requestedURL.pathname)
    .then(id => {
        getVideoData(id)
        .then(data => {
            if (!CRAWLER_UAS.includes(req.headers["user-agent"])
                && !req.query.__bef_tag_debug) {
                res.setHeader("Cache-Control", "private, max-age=1, stale-while-revalidate");
                // redirect the client to the real video URL
                res.redirect(302, data.url);
                return;
            }

            // FIXME: preferredly do this in some other way or somewhere else
            data.oembed = new URL("/oembed", "https://" + req.headers.host).href;
            data.provider = PROVIDER_NAME;
            for (let i of ["author", "bvid", "thumbnail"])
                data[i + "_urlencoded"] = encodeURIComponent(data[i]);

            sendTemplate(res, "template.html", data, "生成 embed 时发生错误", req)
        })
        .catch(e => {
            sendError(res, 500, "获取视频信息时发生错误", e, req);
        });
    })
    .catch(e => {
        sendError(res, 500, "解析请求的 URL 时发生错误", e, req);
    });
}
