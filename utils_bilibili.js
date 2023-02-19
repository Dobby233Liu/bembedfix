import fetch from "node-fetch";
import { formatISODuration } from "date-fns";
import { PROVIDER_NAME, PROVIDER_URL } from "./conf.js";
import { checkIfUrlIsUnderDomain, stripTrailingSlashes } from "./utils.js";

async function getOriginalURLOfB23TvRedir(url) {
    const response = await fetch(url);

    // is this not a redirect? if yes, check if we've got an error
    if (!response.redirected) {
        let responseData;
        try {
            responseData = await response.text();
        } catch (e) {
            e.message = `请求了 ${url}，但是服务器没有进行跳转，而且获取回应失败？` + "\n" + e.message;
            throw e;
        }

        if (!response.ok) {
            throw new Error(`对 ${url} 的请求失败。（HTTP 状态码为 ${response.status}）请检查您的链接。` + "\n" + responseData);
        } else {
            // server might be returning 200 for a not found error, check it here
            let responseDataJson;
            try {
                responseDataJson = JSON.parse(responseData);
            } catch (_) {}
            if (responseDataJson && responseDataJson.code && responseDataJson.code != 0)
                throw new Error(`对 ${url} 的请求失败。（HTTP 状态码为 ${response.status}）请检查您的链接。` + "\n" + responseData);
            throw new Error(`请求了 ${url}，但是服务器返回了一段奇妙的内容？（HTTP 状态码为 ${response.status}）请检查您的链接，如果正常，那么就是我们的 bug。` + "\n" + responseData);
        }
    }

    return new URL(response.url);
}

// Match 1: the ID of the video
const MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX = /^\/(?=(?=s\/)?video\/)?((?=av|BV)[A-Za-z0-9]+)/;

const isUrlOnBilibiliMainSite = u => checkIfUrlIsUnderDomain(u.hostname, "bilibili.com");
const isPathMainSiteVideoPage = p => MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.test(p);
const isUrlBilibiliVideo = u => isUrlOnBilibiliMainSite(u) && isPathMainSiteVideoPage(u.pathname);

const getVideoIdByPath = p => MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.exec(stripTrailingSlashes(p))[1];

export async function getRequestedInfo(path, search) {
    let ret = {
        type: "video",
        id: null,
        page: null
    }

    // default domain for later
    let url = new URL(path, "https://b23.tv");

    // url for video pages on www|m.bilibili.com has a specific pattern
    if (!isPathMainSiteVideoPage(url.pathname)) {
        // must've a b23.tv shortlink
        url = await getOriginalURLOfB23TvRedir(url);
        if (!isUrlBilibiliVideo(url)) {
            throw new Error("这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。\n" + `跳转到了 ${redirectedURL.href} （未跳转的 URL：${url.href}）`);
        }
    } else {
        url.hostname = "www.bilibili.com"
    }

    ret.id = getVideoIdByPath(url.pathname);
    ret.page = parseInt(search.get("p")) ?? 1;
    if (isNaN(ret.page)) {
        ret.page = 1;
    }

    return ret;
}

export function makeVideoPage(bvid, page = 1) {
    const ret = new URL(bvid, "https://www.bilibili.com/video/");
    ret.searchParams.set("p", page);
    return ret;
}
export function makeEmbedPlayer(bvid, cid, page = 1) {
    // //player.bilibili.com/player.html?aid=429619610&bvid=BV1GG411b7sc&cid=805522554&page=1
    const ret = new URL("https://player.bilibili.com/player.html");
    ret.searchParams.set("bvid", bvid);
    ret.searchParams.set("cid", cid);
    ret.searchParams.set("page", page);
    return ret;
}
export function makeEmbedPlayerHTML(bvid, cid, page = 1) {
    return `<iframe src="${makeEmbedPlayer(bvid, cid, page)}" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>`;
}
export function makeUserPage(mid) {
    return new URL(mid, "https://space.bilibili.com").href;
}

function getCompatDescription(desc = "", length = 160) {
    const elipsis = "……";
    let ret = desc;
    ret = ret.replace(/\r\n/g, " ").replace(/\n/g, " ").trim();
    if (ret.length > length) {
        return ret.slice(0, length - elipsis.length) + elipsis;
    }
    return ret;
}

export async function getVideoData(info) {
    const id = info.id;

    const requestURL = new URL("https://api.bilibili.com/x/web-interface/view");
    const idType = id.startsWith("BV") ? "bvid" : "aid";
    requestURL.searchParams.append(idType, id.substring(2, id.length));

    const response = await fetch(requestURL);
    const errorMsg = `对 ${requestURL} 的请求失败。（HTTP 状态码为 ${response.status}）请检查您的链接。`;
    const dataRaw = await response.text();
    if (!response.ok)
        throw new Error(errorMsg + "\n" + dataRaw);
    let res;
    try {
        res = JSON.parse(dataRaw);
    } catch (_) {}
    if (!res)
        throw new Error(`请求了 ${requestURL}，但无法解析服务器回复的内容。可能发生了错误。请检查您的链接，如果没有问题，则请上报 bug。` + "\n" + dataRaw);
    if (res.code && res.code != 0)
        throw new Error(errorMsg + "\n" + dataRaw);

    const resInfo = res.data;

    // For the thumbnail, the API returns a link with the insecure
    // HTTP protocol; fix that
    const picWithSecureProto = new URL(resInfo.pic);
    picWithSecureProto.protocol = "https:";

    let ret = {
        bvid: resInfo.bvid,
        page: info.page ?? 1,
        title: resInfo.title,
        author: resInfo.owner.name,
        author_mid: resInfo.owner.mid,
        author_url: makeUserPage(resInfo.owner.mid),
        thumbnail: picWithSecureProto,
        compat_description: getCompatDescription(resInfo.desc),
    };
    ret = {
        ...ret,
        cid: resInfo.pages[ret.page-1].cid ?? resInfo.cid,
        duration: formatISODuration({ seconds: (resInfo.pages[ret.page-1] ?? resInfo.pages[0]).duration }),
    };
    ret = {
        ...ret,
        url: makeVideoPage(resInfo.bvid, info.page),
        embed_url: makeEmbedPlayer(resInfo.bvid, ret.cid, ret.page)
    };
    return ret;
}

export function getOembedData(query) {
    const defWidth = 1280;
    const defHeight = 720;
    let width = query.maxwidth ? Math.min(+query.maxwidth, defWidth) : defWidth;
    let height = query.maxheight ? Math.min(+query.maxheight, defHeight) : defHeight;

    return {
        version: "1.0",
        type: query.type,
        url: makeVideoPage(query.bvid, query.page),
        html: makeEmbedPlayerHTML(query.bvid, query.cid, query.page),
        width: width,
        height: height,
        thumbnail_url: query.pic,
        thumbnail_width: width,
        thumbnail_height: height,
        author_name: query.author,
        author_url: makeUserPage(query.mid),
        provider_name: PROVIDER_NAME,
        provider_url: PROVIDER_URL
    };
}
