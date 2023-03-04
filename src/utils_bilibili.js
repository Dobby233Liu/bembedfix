import _fetch from "@vercel/fetch";
const fetch = _fetch();
import { formatISODuration } from "date-fns";
import {
    checkIfURLIsUnderDomain,
    stripTrailingSlashes,
    getCompatDescription,
    oembedAddExtraMetadata,
    assert,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
} from "./utils.js";

// Group 4 is the ID of the video
const MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX =
    /^\/((s\/)?(video\/)?)((?=av|BV)[A-Za-z0-9]+)/;

export const isUrlOnBilibiliMainSite = (u) =>
    checkIfURLIsUnderDomain(u.hostname, "bilibili.com");
export const isPathMainSiteVideoPage = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.test(p);
export const isUrlBilibiliVideo = (u) =>
    isUrlOnBilibiliMainSite(u) && isPathMainSiteVideoPage(u.pathname);

export const getVideoIdByPath = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.exec(stripTrailingSlashes(p))[4];

export function makeVideoPage(vid, page = 1) {
    const ret = new URL(vid, "https://www.bilibili.com/video/");
    if (page != 1) ret.searchParams.set("p", page);
    return ret.href;
}

export function makeEmbedPlayerURL(vid, cid, page = 1) {
    // //player.bilibili.com/player.html?aid=429619610&bvid=BV1GG411b7sc&cid=805522554&page=1
    const ret = new URL("https://player.bilibili.com/player.html");
    if (vid.startsWith("BV")) {
        ret.searchParams.set("bvid", vid);
    } else {
        ret.searchParams.set("aid", vid.slice(2));
    }
    ret.searchParams.set("cid", cid);
    ret.searchParams.set("page", page);
    return ret.href;
}

export function makeEmbedPlayer(bvid, cid, page = 1) {
    return `<iframe src="${makeEmbedPlayerURL(
        bvid,
        cid,
        page
    )}" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>`;
}

export function makeUserPage(mid) {
    return new URL(mid, "https://space.bilibili.com").href;
}

function errorFromBilibili(e, data) {
    if (!Object.keys(data).includes("code")) return;

    const code = data.code;
    let myCode = -code;

    if (
        myCode == -1 ||
        myCode == 643 ||
        myCode == -110001 ||
        myCode == -62002 ||
        myCode == -62004 ||
        myCode == -40003 ||
        myCode == -19002003 ||
        myCode == 7201006 ||
        myCode == 72010027 ||
        myCode == -79502 ||
        myCode == -79503
    ) {
        myCode = 404;
    } else if (myCode == 6 || myCode == 101 || myCode == 688 || myCode == 689) {
        myCode = 403;
    } else if (
        myCode == 1 ||
        myCode == 3 ||
        myCode == 111 ||
        myCode == 304 ||
        myCode == 307 ||
        myCode == 400 ||
        (myCode == 401 && data.message && data.message.includes("非法")) ||
        myCode == 405 ||
        myCode == 409 ||
        myCode == 412 ||
        (myCode >= 500 && myCode <= 701) ||
        myCode == 8888 ||
        myCode == -40001 ||
        myCode == 72000000 ||
        code >= 0
    ) {
        myCode = 500;
    }

    e.httpError = myCode;
    return e;
}

async function getOriginalURLOfB23TvRedir(url) {
    const response = await fetch(url.href);

    // is this not a redirect? if so, check if we've got an error
    // (vercel hates me https://github.com/vercel/fetch/blob/23038037ee/packages/fetch/index.js#L43)
    if (new URL(response.url).hostname == "b23.tv") {
        let responseData;
        try {
            responseData = await response.text();
        } catch (e) {
            e.message =
                `请求了 ${url}，但是服务器没有进行跳转，而且获取回应失败？` +
                "\n" +
                e.message;
            throw e;
        }

        let responseDataJson;
        try {
            responseDataJson = JSON.parse(responseData);
        } catch (_) {
            responseDataJson = {};
        }

        if (!response.ok) {
            throw errorFromBilibili(
                new Error(
                    `对 ${url} 的请求失败。（HTTP 状态码为 ${response.status}）请检查您的链接。` +
                        "\n" +
                        responseData
                ),
                responseDataJson
            );
        } else if (responseDataJson.code && responseDataJson.code != 0) {
            throw errorFromBilibili(
                new Error(
                    `对 ${url} 的请求失败。（HTTP 状态码为 ${response.status}）请检查您的链接。` +
                        "\n" +
                        responseData
                ),
                responseDataJson
            );
        }
        throw new Error(
            `请求了 ${url}，但是服务器返回了一段奇妙的内容？（HTTP 状态码为 ${response.status}）请检查您的链接，如果正常，那么就是我们的 bug。` +
                "\n" +
                responseData
        );
    }

    return new URL(response.url);
}

export async function getRequestedInfo(path, search) {
    let ret = {
        type: "video",
        id: null,
        page: null,
    };

    // default domain for later
    let url = new URL(path, "https://b23.tv");

    // url for video pages on www|m.bilibili.com has a specific pattern
    if (!isPathMainSiteVideoPage(url.pathname)) {
        // must've a b23.tv shortlink
        url = await getOriginalURLOfB23TvRedir(url);
        if (!isUrlBilibiliVideo(url)) {
            throw new Error(
                "这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。\n" +
                    `跳转到了 ${url.href} （未跳转的 URL：${url.href}）`
            );
        }
    }

    ret.id = getVideoIdByPath(url.pathname);
    ret.page = parseInt(search.get("p")) || 1;

    return ret;
}

export async function getVideoData(info) {
    const id = info.id;

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

    const resInfo = res.data;

    let page = info.page && info.page <= resInfo.pages.length ? info.page : 1;
    let cid = resInfo.pages[page - 1].cid ?? resInfo.cid;
    let width =
            resInfo.pages[page - 1].dimension.width ??
            resInfo.dimension.width ??
            DEFAULT_WIDTH,
        height =
            resInfo.pages[page - 1].dimension.height ??
            resInfo.dimension.height ??
            DEFAULT_HEIGHT;
    let tWidth = resInfo.dimension.width ?? DEFAULT_WIDTH,
        tHeight = resInfo.dimension.height ?? DEFAULT_HEIGHT;
    const pic = new URL(resInfo.pic);
    pic.protocol = "https:";
    if (pic.hostname.endsWith("hdslb.com") && pic.pathname.startsWith("/bfs/"))
        pic.pathname += encodeURIComponent(`@${tWidth}w_${tHeight}h`);

    return {
        url: makeVideoPage(resInfo.bvid, info.page),
        bvid: resInfo.bvid,
        page: page,
        cid: cid,
        embed_url: makeEmbedPlayerURL(resInfo.bvid, cid, page),
        title: resInfo.title,
        author: resInfo.owner.name,
        author_mid: resInfo.owner.mid,
        author_url: makeUserPage(resInfo.owner.mid),
        compat_description: getCompatDescription(resInfo.desc),
        thumbnail: pic.href,
        thumbnail_width: tWidth,
        thumbnail_height: tHeight,
        width: width,
        height: height,
        duration: formatISODuration({
            seconds: resInfo.pages[page - 1].duration,
        }),
        oembedData: {
            type: "video",
            url: makeVideoPage(resInfo.bvid, page),
            html: makeEmbedPlayer(resInfo.bvid, cid, page),
            width: width,
            height: height,
            thumbnail_url: pic.href,
            thumbnail_width: tWidth,
            thumbnail_height: tHeight,
            author_name: resInfo.owner.name,
            author_url: makeUserPage(resInfo.owner.mid),
        },
        oembedAPIQueries: {
            type: "video",
            bvid: resInfo.bvid,
            page: page,
            cid: cid,
            width: width,
            height: height,
            pic: pic.href,
            twidth: tWidth,
            theight: tHeight,
            author: resInfo.owner.name,
            mid: resInfo.owner.mid,
        },
    };
}

export function loadOembedDataFromQuerystring(query) {
    assert(query.type == "video");
    return oembedAddExtraMetadata(
        {
            type: query.type,
            url: makeVideoPage(query.bvid, query.page),
            html: makeEmbedPlayer(query.bvid, query.cid, query.page),
            width: query.width,
            height: query.height,
            thumbnail_url: query.pic,
            thumbnail_width: query.twidth,
            thumbnail_height: query.theight,
            author_name: query.author,
            author_url: makeUserPage(query.mid),
        },
        query
    );
}
