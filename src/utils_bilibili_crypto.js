import { FAKE_CLIENT_UA_HEADERS } from "./constants.js";
import { assert } from "./utils.js";
import * as crypto from "node:crypto";

// WBI - risk control for web
// XREF: https://socialsisteryi.github.io/bilibili-API-collect/docs/misc/sign/wbi.html#javascript

/**
 * @param {import("fetch-cookie").FetchCookieImpl} fetchCookie
 */
// FIXME: We'd want to cache this for a day (in BJT) long somehow
export async function wbiGetKeys(
    fetchCookie,
    referer = "https://www.bilibili.com",
) {
    const response = await fetchCookie(
        "https://api.bilibili.com/x/web-interface/nav",
        {
            headers: FAKE_CLIENT_UA_HEADERS,
            referer: referer instanceof URL ? referer.href : referer,
            referrerPolicy: "strict-origin-when-cross-origin",
        },
    );

    let responseDataRaw;
    try {
        responseDataRaw = await response.text();
    } catch (e) {
        e.message =
            `请求 WBI 签名口令失败。（HTTP 状态码为 ${response.status}）` +
            "\n" +
            e.message;
        e.httpError = 500;
        throw e;
    }

    let responseData = {};
    try {
        responseData = JSON.parse(responseDataRaw);
    } catch (e) {
        e;
        // pass
    }
    if (
        !response.ok ||
        (responseData.code && ![0, -101].includes(responseData.code))
    ) {
        // Using errorFromBilibili here would cause a circular reference
        let e = new Error(
            `请求 WBI 签名口令失败。（HTTP 状态码为 ${response.status}）` +
                "\n" +
                responseDataRaw +
                (responseData.code &&
                (-responseData.code == 352 || -responseData.code == 412)
                    ? "\n请求疑似被 bilibili 风控系统拦截，请稍后再试。"
                    : ""),
        );
        e.httpError = 500;
        throw e;
    }

    function getKeyFromFakeBfsPath(path) {
        // Future-proof
        let paramLoc = path.indexOf("@");
        path = path.slice(
            path.lastIndexOf("/") + 1,
            paramLoc >= 0 ? paramLoc : path.length,
        );
        path = path.slice(0, path.lastIndexOf("."));
        assert(path.length >= 32);
        return path;
    }

    const img = getKeyFromFakeBfsPath(
            new URL(responseData.data.wbi_img.img_url).pathname,
        ),
        sub = getKeyFromFakeBfsPath(
            new URL(responseData.data.wbi_img.sub_url).pathname,
        ),
        mixin = wbiGenMixinKey(img, sub);
    return { img, sub, mixin };
}

const WBI_MIXIN_KEY_SHUFFLE_ORDER = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
];

function wbiGenMixinKey(img, sub) {
    const fullKey = img + sub;
    return WBI_MIXIN_KEY_SHUFFLE_ORDER.map((i) => fullKey.charAt(i))
        .join("")
        .slice(0, 32);
}

const WBI_SIGN_CHAR_FILTER_REGEX = /[!'()*]/g;

/**
 * @param {URL} url
 */
export function wbiSignURLSearchParams(url, mixinKey) {
    url.searchParams.set("wts", Math.round(Date.now() / 1000));
    url.searchParams.sort();
    url.searchParams.forEach((value, key) => {
        url.searchParams.set(
            key,
            value.replace(WBI_SIGN_CHAR_FILTER_REGEX, ""),
        );
    });
    let query = "?" + url.searchParams.toString();

    const signature = crypto
        .createHash("md5")
        .update(query + mixinKey)
        .digest("hex");
    query += `&w_rid=${signature}`;

    url.search = query;
    return url;
}
