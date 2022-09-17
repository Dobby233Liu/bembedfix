import { sendOembed, sendTemplate, generateError } from "./utils.js";
import { getVideoIdByPath, grabVideoStreamFromBVID, getVideoData, getOembedData } from "./utils_bilibili.js";
import { PROJECT_URL, PROVIDER_NAME, CRAWLER_UAS } from "./conf.js";

export default function handler(req, res) {
    res.setHeader("Cache-Control", "max-age=0, s-maxage=0");

    let parsableURL = new URL(req.url, "https://" + req.headers.host);

    if (parsableURL.pathname == "/favicon.ico") {
        res.setHeader("Cache-Control", "max-age=86400, s-maxage=86400");
        res.redirect(301, "https://www.bilibili.com/favicon.ico");
        return;
    }

    if (parsableURL.pathname == "/videoplayback") {
        res.setHeader("Content-Type", "text/plain");//video/mp4");
        grabVideoStreamFromBVID(req.query.bvid).pipe(res);
        return;
    }

    res.setHeader("Cache-Control", "s-maxage=1, stale-while-revalidate");

    if (parsableURL.pathname == "/oembed.json" || parsableURL.pathname == "/oembed.xml") {
        sendOembed(getOembedData(req.query), res, parsableURL.pathname.endsWith(".xml"));
        return;
    }

    // FIXME: preserve some queries
    getVideoIdByPath(parsableURL.pathname)
    .then(id => {
        getVideoData(id)
        .then(data => {
            if (!CRAWLER_UAS.includes(req.headers["user-agent"]) && !req.query.__bef_tag_debug) {
                res.setHeader("Cache-Control", "IGNORE");
                res.redirect(302, data.url);
                return;
            }
            data.oembed = new URL("/oembed.", "https://" + req.headers.host).href;
            data.provider = PROVIDER_NAME;
            for (let i of ["author", "bvid", "thumbnail"])
                data[i + "_urlencoded"] = encodeURIComponent(data[i]);
            sendTemplate(res, "template.html", data, "An error ocurred while rendering the embed", req)
        })
        .catch(e => {
            // console.log(e);
            res
                .status(500)
                .send(generateError(500, "An error occurred while retrieving video information", e, req));
        });
    })
    .catch(e => {
        // console.log(e);
        res.redirect(301, PROJECT_URL);
    });
}
