import fetch from "node-fetch";
import { PROVIDER_NAME, PROVIDER_URL } from "./conf.js";

// Match 1: the ID of the video
const MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX = /^\/video\/((?=av|BV)[A-Za-z0-9]+)/;

// FIXME: relocate this
function checkIfUrlIsUnderDomain(l, r) {
    let levelsOfDomainLeft = l.split(".");
    let levelsOfDomainRight = r.split(".");
    if (levelsOfDomainLeft.length < levelsOfDomainRight.length)
        return false;
    return levelsOfDomainLeft
        .slice(-levelsOfDomainRight.length)
        .every((level, index) => level == levelsOfDomainRight[index]);
}

const isUrlOnBilibiliMainSite = u => checkIfUrlIsUnderDomain(u.hostname, "bilibili.com");
const isPathMainSiteVideoPage = p => MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.test(p);
const isUrlBilibiliVideo = u => isUrlOnBilibiliMainSite(u) && isPathMainSiteVideoPage(u.pathname);

async function getOriginalURLOfB23TvRedir(url) {
    const response = await fetch(url);

    // is this a not-a-redirect? if yes, check if we've got an error
    if (!response.redirected) {
        let responseData = "";
        try {
            responseData = await response.text();
        } catch (e) {
            e.message = "b23.tv did not return a redirect for " + url + ", but instead a response that we can't get the content of???\n" + e.message;
            throw e;
        }

        if (!response.ok) {
            throw new Error("Got error while retrieving " + url + " (HTTP status code: " + response.status + ")\n" + responseData);
        } else {
            // server might be returning 200 for a not found error, check it here
            let responseDataJson;
            try {
                responseDataJson = JSON.parse(responseData);
            } catch (_) {}
            if (responseDataJson && responseDataJson.code && responseDataJson.code != 0)
                throw new Error("Got error while retrieving " + url + " (HTTP status code: " + response.status + ")\n" + responseData);
            throw new Error("b23.tv did not return a redirect for " + url + ", but instead a successful response/response of an unknown format??? (HTTP status code: " + response.status + ")\n" + responseData);
        }
    }

    return new URL(response.url);
}

const getVideoIdByUrl = u => MAIN_SITE_VIDEO_PAGE_PATHNAME_REGEX.exec(u.pathname)[1];

export async function getVideoIdByPath(path) {
    let url = new URL(path, "https://b23.tv");

    // paths of b23.tv links won't start with /video/
    if (isPathMainSiteVideoPage(url.pathname)) {
        return getVideoIdByUrl(url);
    }
    const redirectedURL = await getOriginalURLOfB23TvRedir(url);
    if (isUrlBilibiliVideo(redirectedURL)) {
        return getVideoIdByUrl(redirectedURL);
    }

    throw new Error("This doesn't seem to be a video. Got URL " + redirectedURL.href + " (" + url.href + " before following redirection)");
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
    let requestURL = new URL("https://api.bilibili.com/x/web-interface/view");
    let idType = id.startsWith("BV") ? "bvid" : "aid";
    requestURL.searchParams.append(idType, id.substring(2, id.length));
    let response = await fetch(requestURL);
    let data = await response.json();
    if (!response.ok || data.code != 0)
        throw new Error(JSON.stringify(data));

    // For the thumbnail, API returns a link with the insecure
    // HTTP protocol; fix that
    let picWithSecureProto = new URL(data.data.pic);
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
