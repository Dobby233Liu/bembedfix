import fetch from "node-fetch";
import { PROVIDER_NAME, PROVIDER_URL } from "./conf.js";
import { checkIfUrlIsUnderDomain } from "./utils.js";

async function getOriginalURLOfB23TvRedir(url) {
    const response = await fetch(url);

    // is this not a redirect? if yes, check if we've got an error
    if (!response.redirected) {
        let responseData;
        try {
            responseData = await response.text();
        } catch (e) {
            e.message = `请求了 ${url}，但是服务器没有进行跳转，而且获取回应失败？？？` + "\n" + e.message;
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
            throw new Error(`请求了 ${url}，但是服务器返回了一段奇妙的内容？？？（HTTP 状态码为 ${response.status}）请检查您的链接，如果正常，那么就是我们的 bug。` + "\n" + responseData);
        }
    }

    return new URL(response.url);
}

// Match 1: the ID of the video
const MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX = /^(?=\/s)?\/video\/((?=av|BV)[A-Za-z0-9]+)/;

const isUrlOnBilibiliMainSite = u => checkIfUrlIsUnderDomain(u.hostname, "bilibili.com");
const isPathMainSiteVideoPage = p => MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.test(p);
const isUrlBilibiliVideo = u => isUrlOnBilibiliMainSite(u) && isPathMainSiteVideoPage(u.pathname);

const getVideoIdByPath = p => MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.exec(p)[1];

export async function getVideoIdByPathSmart(path) {
    // default domain for later
    let url = new URL(path, "https://b23.tv");

    // url for video pages on www|m.bilibili.com has a special pattern
    if (isPathMainSiteVideoPage(url.pathname)) {
        return getVideoIdByPath(url.pathname);
    }

    // must've a b23.tv shortlink
    const redirectedURL = await getOriginalURLOfB23TvRedir(url);
    if (isUrlBilibiliVideo(redirectedURL)) {
        return getVideoIdByPath(redirectedURL.pathname);
    }

    throw new Error("这似乎不是一个视频——本服务目前只支持对视频页面进行 embed 修正。\n" + `跳转到了 ${redirectedURL.href} （未跳转的 URL：${url.href}）`);
}

export function makeVideoPage(bvid) {
    return "https://www.bilibili.com/video/" + encodeURI(bvid);
}
export function makeEmbedPlayer(bvid) {
    // //player.bilibili.com/player.html?aid=429619610&bvid=BV1GG411b7sc&cid=805522554&page=1
    return "https://player.bilibili.com/player.html?bvid=" + encodeURIComponent(bvid);
}
export function makeEmbedPlayerHTML(bvid) {
    return `<iframe src="${makeEmbedPlayer(bvid)}" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>`;
}
export function makeUserPage(mid) {
    return new URL(encodeURI("/" + mid), "https://space.bilibili.com").href;
}

export async function getVideoData(id) {
    const requestURL = new URL("https://api.bilibili.com/x/web-interface/view");
    const idType = id.startsWith("BV") ? "bvid" : "aid";
    requestURL.searchParams.append(idType, id.substring(2, id.length));

    const response = await fetch(requestURL);
    const errorMsg = `对 ${requestURL} 的请求失败。（HTTP 状态码为 ${response.status}）请检查您的链接。`;
    const dataRaw = await response.text();
    if (!response.ok)
        throw new Error(errorMsg + "\n" + dataRaw);
    let data;
    try {
        data = JSON.parse(dataRaw);
    } catch (_) {}
    if (!data)
        throw new Error(`请求了 ${requestURL}，但无法解析服务器回复的内容。可能发生了错误。请检查您的链接，如果没有问题，则请上报 bug。` + "\n" + dataRaw);
    if (data.code && data.code != 0)
        throw new Error(errorMsg + "\n" + dataRaw);

    // For the thumbnail, API returns a link with the insecure
    // HTTP protocol; fix that
    const picWithSecureProto = new URL(data.data.pic);
    picWithSecureProto.protocol = "https:";

    return {
        bvid: data.data.bvid,
        url: makeVideoPage(data.data.bvid),
        embed_url: makeEmbedPlayer(data.data.bvid),
        title: data.data.title,
        author: data.data.owner.name,
        author_mid: data.data.owner.mid,
        upload_date: new Date(data.data.ctime * 1000).toISOString(),
        release_date: new Date(data.data.pubdate * 1000).toISOString(),
        thumbnail: picWithSecureProto,
    };
}

export function getOembedData(query) {
    let width = query.maxwidth ? Math.min(+query.maxwidth, 720) : 720;
    let height = query.maxheight ? Math.min(+query.maxheight, 480) : 480;

    return {
        version: "1.0",
        type: query.type,
        url: makeVideoPage(query.bvid),
        html: makeEmbedPlayerHTML(query.bvid),
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
