import fetch from "./fetch.js";

import {
    checkIfURLIsUnderDomain
} from "./utils.js";

// Group 4 is the ID of the video
export const MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX =
    /^\/((s\/)?(video\/)?)((?=av|BV)[A-Za-z0-9]+)/;
export const STRICTLY_MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX =
    /^\/((s\/)?(video\/))((?=av|BV)[A-Za-z0-9]+)/;

export const isUrlOnBilibiliMainSite = (u) =>
    checkIfURLIsUnderDomain(u.hostname, "bilibili.com");
export const isPathMainSiteVideoPage = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.test(p);
export const isUrlBilibiliVideo = (u) =>
    isUrlOnBilibiliMainSite(u) && isPathMainSiteVideoPage(u.pathname);

export const getVideoIdByPath = (p) =>
    MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.exec(p)[4];

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

export async function getOriginalURLOfB23TvRedir(url) {
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

export function errorFromBilibili(e, data) {
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