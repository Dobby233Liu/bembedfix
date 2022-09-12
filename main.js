import * as utils from "./utils.js";
import * as bili from "./utils_bilibili.js";
import { PROJECT_URL, PROVIDER_NAME } from "./conf.js";

export default function handler(req, res) {
    let parsableURL = new URL(req.url, "https://" + req.headers.host);

    if (parsableURL.pathname == "/favicon.ico") {
        res.setHeader("Cache-Control", "max-age=86400, s-maxage=86400");
        res.redirect(301, "https://www.bilibili.com/favicon.ico");
        return;
    }

    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate");

    if (parsableURL.pathname == "/oembed.json") {
        utils.sendOembed(req.query, res, false);
        return;
    }

    let videoURL;
    try {
        videoURL = bili.getVideoURL(req.url);
    } catch (e) {
        // console.log(e);
        res.redirect(301, PROJECT_URL);
        return;
    }

    let videoID;
    // FIXME: preserve some queries
    bili.checkVideoAndGetId(videoURL)
    .then(id => {
        bili.getVideoData(id)
        .then(data => {
            data.oembed = new URL("/oembed.json", "https://" + req.headers.host).href;
            data.provider = PROVIDER_NAME;
            for (let i of ["author", "bvid", "thumbnail"])
                data[i + "_urlencoded"] = encodeURIComponent(data[i]);
            utils.sendTemplate(res, "template.html", data, "An error ocurred while rendering the embed", req)
        })
        .catch(e => {
            // console.log(e);
            res
                .status(500)
                .send(utils.generateError(500, "An error occurred while retrieving video information", e, req));
        });
    })
    .catch(e => {
        // console.log(e);
        res.redirect(301, PROJECT_URL);
    });
}
