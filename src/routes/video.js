import fetch from "../fetch.js";
import { formatISODuration } from "date-fns";

import {
    getCompatDescription,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
} from "../utils.js";
import {
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX,
    errorFromBilibili,
    makeVideoPage,
    makeEmbedPlayer,
    makeEmbedPlayerURL,
    makeUserPage
} from "../utils_bilibili.js";

import { DomainMatchingMode } from "./_metadef.js";

async function handler(url, matchKind, matchResult) {
    let id = matchResult.path[4]; // Group 4 is the ID of the video
    let page = parseInt(url.searchParams.get("p")) || 1;

    const requestURL = new URL("https://api.bilibili.com/x/web-interface/view");
    const idType = id.startsWith("BV") ? "bvid" : "aid";
    requestURL.searchParams.append(idType, id.slice(2));

    const response = await fetch(requestURL.href);
    const errorMsg = `对 ${requestURL} 的请求失败。（HTTP 状态码为 ${response.status}）请检查您的链接。`;
    const dataRaw = await response.text();
    let res = {};
    try {
        res = JSON.parse(dataRaw);
    } catch (e) {
        const msgHere = response.ok
            ? `请求了 ${requestURL}，但无法解析服务器回复的内容。可能发生了错误。请检查您的链接，如果没有问题，则请上报 bug。`
            : errorMsg;
        e.message = msgHere + "\n" + e.message + "\n" + dataRaw;
        throw e;
    }
    if (!response.ok || (res.code && res.code != 0))
        throw errorFromBilibili(new Error(errorMsg + "\n" + dataRaw), res);

    const videoInfo = res.data;

    page = page <= videoInfo.pages.length ? page : 1;
    let cid = videoInfo.pages[page - 1].cid ?? videoInfo.cid;
    let width =
        videoInfo.pages[page - 1].dimension.width ??
        videoInfo.dimension.width ??
        DEFAULT_WIDTH,
        height =
            videoInfo.pages[page - 1].dimension.height ??
            videoInfo.dimension.height ??
            DEFAULT_HEIGHT;
    let tWidth = videoInfo.dimension.width ?? DEFAULT_WIDTH,
        tHeight = videoInfo.dimension.height ?? DEFAULT_HEIGHT;
    const pic = new URL(videoInfo.pic);
    pic.protocol = "https:";
    if (pic.hostname.endsWith("hdslb.com") && pic.pathname.startsWith("/bfs/"))
        pic.pathname += encodeURIComponent(`@${tWidth}w_${tHeight}h`);

    return {
        url: makeVideoPage(videoInfo.bvid, page),
        bvid: videoInfo.bvid,
        page: page,
        cid: cid,
        embed_url: makeEmbedPlayerURL(videoInfo.bvid, cid, page),
        title: videoInfo.title,
        author: videoInfo.owner.name,
        author_mid: videoInfo.owner.mid,
        author_url: makeUserPage(videoInfo.owner.mid),
        compat_description: getCompatDescription(videoInfo.desc),
        thumbnail: pic.href,
        thumbnail_width: tWidth,
        thumbnail_height: tHeight,
        width: width,
        height: height,
        duration: formatISODuration({
            seconds: videoInfo.pages[page - 1].duration,
        })
    };
}

export default {
    matches: [
        {
            path: MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX,
            domain: "bilibili.com",
            domainMatchingMode: DomainMatchingMode.NEEDED_FOR_RESOLVED_SHORTLINKS
        }
    ],
    handler: handler,
    oembed: {
        type: "video",
        dataConverter: {
            url: {
                convertFromHandlerResults: (results) => makeVideoPage(results.bvid, results.page),
                expressAsQuery: null,
                convertFromAPIQueries: (query) => makeVideoPage(query.bvid, query.p)
            },
            html: {
                convertFromHandlerResults: (results) => makeEmbedPlayer(results.bvid, results.cid, results.page),
                expressAsQuery: null,
                convertFromAPIQueries: (query) => makeEmbedPlayer(query.bvid, query.cid, query.p)
            },
            width: {
                convertFromHandlerResults: (results) => results.width,
                expressAsQuery: "width",
            },
            height: {
                convertFromHandlerResults: (results) => results.height,
                expressAsQuery: "height",
            },
            thumbnail_url: {
                convertFromHandlerResults: (results) => results.thumbnail,
                expressAsQuery: "pic",
            },
            thumbnail_width: {
                convertFromHandlerResults: (results) => results.thumbnail_width,
                expressAsQuery: "twidth",
            },
            thumbnail_height: {
                convertFromHandlerResults: (results) => results.thumbnail_height,
                expressAsQuery: "theight",
            },
            author_name: {
                convertFromHandlerResults: (results) => results.author,
                expressAsQuery: "author",
            },
            author_url: {
                convertFromHandlerResults: (results) => results.author_url,
                expressAsQuery: null,
                convertFromAPIQueries: (query) => makeUserPage(query.mid)
            },
        },
        extraAPIQueries: {
            bvid: (results) => results.bvid,
            p: (results) => results.page,
            cid: (results) => results.cid,
            mid: (results) => results.author_mid
        }
    }
};

/*
            throw new Error(
                "这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。\n" +
                `跳转到了 ${url.href} （未跳转的 URL：${url.href}）`
            );
*/