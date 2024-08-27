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
import { COBALT_API_INSTANCE } from "./constants.js";

// Group 4 is the ID of the video
const MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX =
    /^\/(?:s\/)?(?:video\/)?(av[0-9]+|BV[A-Za-z0-9]+)$/;

export const isURLOnBilibiliMainSite = (u) =>
    checkIfURLIsUnderDomain(u.hostname, "bilibili.com");
export const isPathMainSiteVideoPage = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.test(stripTrailingSlashes(p));
export const isURLBilibiliVideo = (u) =>
    isURLOnBilibiliMainSite(u) && isPathMainSiteVideoPage(u.pathname);

export const getVideoIdByPath = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.exec(stripTrailingSlashes(p))[1];

// I hate my job
const searchParamEntries = (searchParams) =>
    (searchParams instanceof URLSearchParams ? searchParams.entries() : Object.entries(searchParams))

export function makeVideoPage(vid, page = 1, searchParams) {
    const ret = new URL(vid, "https://www.bilibili.com/video/");
    if (page != 1) ret.searchParams.set("p", page);
    if (searchParams) {
        for (const [k, v] of searchParamEntries(searchParams))
            ret.searchParams.set(k, v);
    }
    return ret.href;
}

export function makeEmbedPlayerURL(vid, cid, page = 1, searchParams) {
    // //player.bilibili.com/player.html?aid=429619610&bvid=BV1GG411b7sc&cid=805522554&page=1
    const ret = new URL("https://player.bilibili.com/player.html");
    if (vid.startsWith("BV")) {
        ret.searchParams.set("bvid", vid);
    } else {
        ret.searchParams.set("aid", vid.slice(2));
    }
    ret.searchParams.set("cid", cid);
    ret.searchParams.set("page", page);
    if (searchParams) {
        for (const [k, v] of searchParamEntries(searchParams))
            ret.searchParams.set(k, v);
    }
    return ret.href;
}

export function makeEmbedPlayer(...args) {
    return `<iframe src="${makeEmbedPlayerURL(...args)}" frameborder="0" allowfullscreen></iframe>`;
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

    if (myCode < 200 || myCode >= 600) {
        myCode = 500;
    }

    e.httpError = myCode;
    return e;
}

async function getOriginalURLOfB23TvRedir(url) {
    const response = await fetch(url.href);

    if (!response.redirected) {
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
    } else {
        response.body.cancel();
    }

    return new URL(response.url);
}

export async function getRequestedInfo(path, search) {
    let ret = {
        type: "video",
        id: null,
        page: null,
        searchParams: {
            videoPage: {},
            embedPlayer: {}
        },
    };

    // default domain for later
    let url = new URL(path, "https://b23.tv"), originalURL = url;

    // url for video pages on www|m.bilibili.com has a specific pattern
    if (!isPathMainSiteVideoPage(url.pathname)) {
        for (let knownNonVideoPrefix of ["/cm-huahuo", "/cm-cmt"]) {
            if (url.pathname.startsWith(knownNonVideoPrefix))
                throw new Error(
                    "这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。\n" +
                    `拼接的 URL：${originalURL.href} 匹配已知非视频前缀：${knownNonVideoPrefix}`
                );
        }
        // must've a b23.tv shortlink
        url = await getOriginalURLOfB23TvRedir(url);
        if (!isURLBilibiliVideo(url)) {
            throw new Error(
                "这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。\n" +
                `跳转到了 ${url.href} （未跳转的 URL：${originalURL.href}）`
            );
        }
    }

    ret.id = getVideoIdByPath(url.pathname);
    ret.page = parseInt(search.get("p")) || 1;

    // web / b23.tv
    let startProgress = parseInt(search.get("t")) || parseInt(search.get("start_progress"))
    if (startProgress) {
        ret.searchParams.videoPage["t"] = startProgress;
        // this has to be t for the embed player, start_progress will not work
        ret.searchParams.embedPlayer["t"] = startProgress;
    }

    return ret;
}

export async function getVideoData(info, getVideoURL, dropCobaltErrs) {
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
    let title = resInfo.title;
    if (resInfo.pages.length > 1)
        title += ` - P${page} ${resInfo.pages[page - 1].part}`;
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

    let videoPageURL = makeVideoPage(resInfo.bvid, page, info.searchParams.videoPage);
    let cobaltRepRaw, videoStreamURL;
    if (getVideoURL) {
        try {
            const cobaltRep = await fetch(new URL("/api/json", COBALT_API_INSTANCE).href, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    url: videoPageURL,
                    vQuality: 720,
                    disableMetadata: true
                }),
                // FIXME
                // signal: AbortSignal.timeout(3000)
            });
            cobaltRepRaw = await cobaltRep.text();
            if (!response.ok) {
                if (!dropCobaltErrs)
                    throw cobaltRepRaw;
            }
        } catch (e) {
            if (!dropCobaltErrs)
                throw e;
        }
    }
    if (cobaltRepRaw) {
        let cobaltRepParsed;
        try {
            cobaltRepParsed = JSON.parse(cobaltRepRaw);
        } catch (e) {
            if (!dropCobaltErrs)
                throw e;
        }
        if (cobaltRepParsed) {
            if (cobaltRepParsed.status == "error" || cobaltRepParsed.status == "rate-limit") {
                if (!dropCobaltErrs)
                    throw cobaltRepParsed;
            } else if (cobaltRepParsed.status != "picker") {
                videoStreamURL = cobaltRepParsed.url;
            } else {
                assert(cobaltRepParsed.pickerType == "various");
                videoStreamURL = cobaltRepParsed.picker[page] ? cobaltRepParsed.picker[page].url : cobaltRepParsed.picker[0].url;
            }
        }
    }
    let embedPlayerURL = makeEmbedPlayerURL(resInfo.bvid, cid, page, info.searchParams.embedPlayer);

    const pic = new URL(resInfo.pic);
    pic.protocol = "https:";
    if ((pic.hostname.endsWith("hdslb.com") || pic.hostname == "archive.biliimg.com") && pic.pathname.startsWith("/bfs/")) {
        pic.pathname = pic.pathname.split("@")[0];
        pic.pathname += encodeURIComponent(`@${tWidth}w_${tHeight}h_1c`);
    }

    return {
        url: videoPageURL,
        bvid: resInfo.bvid,
        page: page,
        cid: cid,
        embed_url: embedPlayerURL,
        video_url: videoStreamURL,
        title: title,
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
            url: videoPageURL,
            html: embedPlayerURL,
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
            twidth: width != tWidth ? tWidth : null,
            theight: height != tHeight ? tHeight : null,
            author: resInfo.owner.name,
            mid: resInfo.owner.mid,
            s_vp: info.searchParams.videoPage.length > 0 ? new URLSearchParams(info.searchParams.videoPage).toString() : null,
            s_ep: info.searchParams.embedPlayer.length > 0 ? new URLSearchParams(info.searchParams.embedPlayer).toString() : null,
        },
    };
}

export function loadOembedDataFromQuerystring(query) {
    assert(query.type == "video");
    return oembedAddExtraMetadata(
        {
            type: query.type,
            url: makeVideoPage(query.bvid, query.page, new URLSearchParams(query.s_vp || "")),
            html: makeEmbedPlayer(query.bvid, query.cid, query.page, new URLSearchParams(query.s_ep || "")),
            width: query.width,
            height: query.height,
            thumbnail_url: query.pic,
            // TODO: make this honor maxwidth/maxheight
            thumbnail_width: query.twidth || query.width,
            thumbnail_height: query.theight || query.height,
            author_name: query.author,
            author_url: makeUserPage(query.mid),
        },
        query
    );
}
