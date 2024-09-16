import * as duration from "duration-fns";
import {
    checkDomainIsSubdomainOf,
    stripTrailingSlashes,
    shortenDescription,
    oembedAddExtraMetadata,
    assert,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    obtainVideoStreamFromCobalt,
    parseIntSafe,
    applySearchParams,
} from "./utils.js";
import { FAKE_CLIENT_UA_HEADERS, COBALT_API_INSTANCE } from "./constants.js";
import makeFetchCookie from "fetch-cookie";
import { wbiGetKeys, wbiSignURLSearchParams } from "./utils_bilibili_crypto.js";

// Group 4 is the ID of the video
const MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX =
    /^\/(?:s\/)?(?:video\/)?(av[0-9]+|BV[A-Za-z0-9]+)$/;

export const isURLOnBilibiliMainSite = (u) =>
    checkDomainIsSubdomainOf(u.hostname, "bilibili.com");
export const isPathMainSiteVideoPage = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.test(stripTrailingSlashes(p));
export const isURLBilibiliVideo = (u) =>
    isURLOnBilibiliMainSite(u) && isPathMainSiteVideoPage(u.pathname);

export const getVideoIdByPath = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.exec(stripTrailingSlashes(p))[1];

export function makeVideoPage(vid, page = 1, searchParams) {
    assert(vid);
    const ret = new URL(vid, "https://www.bilibili.com/video/");
    if (page != 1) ret.searchParams.set("p", page);
    applySearchParams(ret, searchParams);
    return ret.href;
}

export function makeEmbedPlayerURL(vid, cid, page = 1, searchParams) {
    assert(vid && cid);
    // //player.bilibili.com/player.html?aid=429619610&bvid=BV1GG411b7sc&cid=805522554&page=1
    const ret = new URL("https://player.bilibili.com/player.html");
    if (vid.startsWith("BV")) {
        ret.searchParams.set("bvid", vid);
    } else {
        ret.searchParams.set("aid", vid.slice(2));
    }
    ret.searchParams.set("cid", cid);
    ret.searchParams.set("page", page);
    applySearchParams(ret, searchParams);
    return ret.href;
}

export function makeEmbedPlayer(...args) {
    return `<iframe src="${makeEmbedPlayerURL(
        ...args,
    )}" frameborder="0" allowfullscreen></iframe>`;
}

export function makeUserPage(mid) {
    return new URL(mid, "https://space.bilibili.com").href;
}

function isRequestLikelyFailed(response, toleratedFailureCodes) {
    let ret =
        "code" in response
            ? ![0, ...(toleratedFailureCodes || [])].includes(response.code)
            : true;
    function isNullOrUndefined(x) {
        return x === null || x === undefined;
    }
    ret = ret || isNullOrUndefined(response.data);
    if (response.data) {
        ret = ret || "v_voucher" in response.data;
    }
    return ret;
}

function errorFromBilibili(e, data) {
    if (!("code" in data)) return e;

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
        myCode == 4511006 || // TODO
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
        myCode == 352 ||
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

    if (myCode == 352 || myCode == 412) {
        e.message += "\n请求疑似被 bilibili 风控系统拦截，请稍后再试。";
    }

    e.httpError = myCode;
    return e;
}

/**
 * @param {string?} destOrigin Used to mimic strict-origin-when-cross-origin behavior. If you don't intend to, leave this as null.
 */
function genSpoofHeaders(referer = null, destOrigin) {
    if (referer) {
        referer = referer instanceof URL ? referer : new URL(referer);
        if (destOrigin && referer.origin != destOrigin)
            referer = referer.protocol + "//" + referer.origin;
        else referer = referer.href;
    }
    return {
        ...FAKE_CLIENT_UA_HEADERS,
        Referer: referer,
    };
}

/**
 * @param {import("fetch-cookie").FetchCookieImpl} fetchCookie
 */
async function getOriginalURLOfB23TvRedir(fetchCookie, url) {
    const response = await fetchCookie(url.href, {
        headers: genSpoofHeaders(),
        referrerPolicy: "strict-origin-when-cross-origin",
    });

    if (!response.redirected) {
        let responseData;
        try {
            responseData = await response.text();
        } catch (e) {
            e.message =
                `尝试了解析短链 ${url}，但是服务器没有进行跳转，而且获取回应失败？` +
                "\n" +
                e.message;
            throw e;
        }

        let responseDataJson;
        try {
            responseDataJson = JSON.parse(responseData);
        } catch (e) {
            e;
            responseDataJson = {};
        }

        if (!response.ok || isRequestLikelyFailed(responseDataJson)) {
            throw errorFromBilibili(
                new Error(
                    `解析短链 ${url} 失败。（HTTP 状态码为 ${response.status}）请检查您的链接。` +
                        "\n" +
                        responseData,
                ),
                responseDataJson,
            );
        }
        throw new Error(
            `尝试了解析短链 ${url}，但是服务器返回了一段奇妙的内容？（HTTP 状态码为 ${response.status}）请检查您的链接。` +
                "\n" +
                responseData,
        );
    } else {
        response.body.cancel();
    }

    return new URL(response.url);
}

export async function getRequestedInfo(path, search) {
    // Do not expose to user
    let info = {
        fetchCookie: null,
        wbiKeys: {},

        type: "video",

        id: null,
        page: null,

        searchParams: {
            videoPage: new URLSearchParams(),
            embedPlayer: new URLSearchParams(),
        },
    };

    // FIXME: Is it wise to create one for every request?
    const fetchCookie = (info.fetchCookie = makeFetchCookie(fetch));

    // default domain for later
    let url = new URL(path, "https://b23.tv"),
        originalURL = url;

    let requestedPage = false;
    // url for video pages on www|m.bilibili.com has a specific pattern
    if (!isPathMainSiteVideoPage(url.pathname)) {
        let notAVideoProlog =
            "这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。\n";
        for (let knownNonVideoPrefix of ["/cm-huahuo", "/cm-cmt"]) {
            if (url.pathname.startsWith(knownNonVideoPrefix))
                throw new Error(
                    notAVideoProlog +
                        `拼接的 URL：${originalURL.href} 匹配已知非视频前缀：${knownNonVideoPrefix}`,
                );
        }
        // must've a b23.tv shortlink
        url = await getOriginalURLOfB23TvRedir(fetchCookie, url);
        requestedPage = true;
        if (!isURLBilibiliVideo(url)) {
            throw new Error(
                notAVideoProlog +
                    `跳转到了 ${url.href} （未跳转的 URL：${originalURL.href}）`,
            );
        }
    }

    info.id = getVideoIdByPath(url.pathname);
    assert(info.id, "无法从 URL 中提取视频 ID");
    info.page = parseIntSafe(search.get("p")) ?? 1;

    const fakeReferer = makeVideoPage(
        info.id,
        info.page,
        info.searchParams.videoPage,
    );
    if (!requestedPage) {
        const fakeRefererRep = await fetchCookie(fakeReferer, {
            headers: genSpoofHeaders(),
        });
        // We're kinda obliged to read it...
        const fakeRefererRepRaw = await fakeRefererRep.text();
        if (
            fakeRefererRep.status == 412 ||
            fakeRefererRepRaw.includes("由于触发哔哩哔哩安全风控策略")
        )
            throw errorFromBilibili(new Error("获取 buvid3 & b_nut 失败。"), {
                code: -352,
            });
    }

    // web / b23.tv
    let startProgress =
        parseIntSafe(search.get("t")) ??
        parseIntSafe(search.get("start_progress"));
    if (startProgress) {
        info.searchParams.videoPage.set("t", startProgress);
        // this has to be t for the embed player, start_progress will not work
        info.searchParams.embedPlayer.set("t", startProgress);
    }

    info.wbiKeys = await wbiGetKeys(fetchCookie, fakeReferer);
    // TODO: buvid4; bili_ticket (for space). Doesn't seem so important right now

    return info;
}

export async function getVideoData(info, getVideoURL, dropCobaltErrs) {
    const oembedMediaType = "video";

    const id = info.id;
    let page = info.page;
    let videoPageURL = makeVideoPage(id, page, info.searchParams.videoPage);

    const requestURL = new URL(
        "https://api.bilibili.com/x/web-interface/wbi/view",
    );
    const idType = id.startsWith("BV") ? "bvid" : "aid";
    requestURL.searchParams.set(idType, id.slice("BV".length));
    wbiSignURLSearchParams(requestURL, info.wbiKeys.mixin);

    /** @type {import("fetch-cookie").FetchCookieImpl} */
    const fetchCookie = info.fetchCookie;

    const response = await fetchCookie(requestURL.href, {
        headers: genSpoofHeaders(videoPageURL, "api.bilibili.com"),
        referrerPolicy: "strict-origin-when-cross-origin",
    });
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
    if (!response.ok || isRequestLikelyFailed(res))
        throw errorFromBilibili(new Error(errorMsg + "\n" + dataRaw), res);

    const resInfo = res.data;

    page = page <= resInfo.pages.length ? page : 1;
    videoPageURL = makeVideoPage(
        resInfo.bvid,
        page,
        info.searchParams.videoPage,
    );
    let cid = resInfo.pages[page - 1].cid ?? resInfo.cid;
    let title = resInfo.title;
    // TODO
    if (resInfo.is_upower_exclusive) title = `【充电专属】${title}`;
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

    let videoStreamURL;
    // TODO: Check is_upower_preview?
    if (COBALT_API_INSTANCE && getVideoURL && !resInfo.is_upower_exclusive) {
        try {
            videoStreamURL = await obtainVideoStreamFromCobalt(
                videoPageURL,
                page,
            );
        } catch (e) {
            if (dropCobaltErrs) {
                // console.warn(e);
            } else {
                throw e;
            }
        }
    }
    let embedPlayerURL = makeEmbedPlayerURL(
        resInfo.bvid,
        cid,
        page,
        info.searchParams.embedPlayer,
    );

    const pic = new URL(resInfo.pic);
    pic.protocol = "https:";
    if (
        (pic.hostname.endsWith("hdslb.com") ||
            pic.hostname == "archive.biliimg.com") &&
        pic.pathname.startsWith("/bfs/")
    ) {
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
        // TODO: Honor resInfo.staff, resInfo.disable_show_up_info?
        author: resInfo.owner.name,
        author_mid: resInfo.owner.mid,
        author_url: makeUserPage(resInfo.owner.mid),
        compat_description: shortenDescription(resInfo.desc),
        thumbnail: pic.href,
        thumbnail_width: tWidth,
        thumbnail_height: tHeight,
        width: width,
        height: height,
        duration: duration.toString(
            duration.normalize({
                seconds: resInfo.pages[page - 1].duration,
            }),
        ),
        oembedData: {
            type: oembedMediaType,
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
            type: oembedMediaType,
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
            s_vp:
                info.searchParams.videoPage.length > 0
                    ? new URLSearchParams(
                          info.searchParams.videoPage,
                      ).toString()
                    : null,
            s_ep:
                info.searchParams.embedPlayer.length > 0
                    ? new URLSearchParams(
                          info.searchParams.embedPlayer,
                      ).toString()
                    : null,
        },
    };
}

export function loadOembedDataFromQueryString(query) {
    let meta = { type: query.type };

    switch (meta.type) {
        case "video":
            meta = {
                ...meta,
                url: makeVideoPage(
                    query.bvid,
                    query.page,
                    new URLSearchParams(query.s_vp || ""),
                ),
                html: makeEmbedPlayer(
                    query.bvid,
                    query.cid,
                    query.page,
                    new URLSearchParams(query.s_ep || ""),
                ),
                width: query.width,
                height: query.height,
                thumbnail_url: query.pic,
                // TODO: make this honor maxwidth/maxheight
                thumbnail_width: query.twidth || query.width,
                thumbnail_height: query.theight || query.height,
                author_name: query.author,
                author_url: makeUserPage(query.mid),
            };
            break;

        default:
            assert(false, "未知 OEmbed 对象类型 " + meta.type);
            break;
    }

    return oembedAddExtraMetadata(meta, query);
}
