import { render, renderFile } from "ejs";
import { join } from "path";
import { ERROR_TEMPLATE, PROVIDER_NAME, PROVIDER_URL } from "./conf.js";
import { makeVideoPage, makeEmbedPlayerHTML, makeUserPage } from "./utils_bilibili.js";

export function generateError(code, message, data, req) {
    let outData = data.toString();
    if (data.stack && data.message) {
        outData += "\n\n" + data.stack;
    }
    return render(ERROR_TEMPLATE,
        { code: code, message: message, data: outData, here: new URL(req.url, "https://" + req.headers.host).href }
    );
}

export function sendTemplate(res, file, data, errorMessage, req) {
    renderFile(join(process.cwd(), file), data)
    .catch(function (err) {
        console.error(err);
        res
            .status(500)
            .send(generateError(500, errorMessage, err, req));
    })
    .then(out => res.send(out));
}

function _getOembedData(query) {
    return {
        version: "1.0",
        type: query.type,
        url: makeVideoPage(query.bvid),
        html: makeEmbedPlayerHTML(query.bvid),
        width: 720,
        height: 480,
        thumbnail_url: query.pic,
        thumbnail_width: 720,
        thumbnail_height: 480,
        author_name: query.author,
        author_url: makeUserPage(query.mid),
        provider_name: PROVIDER_NAME,
        provider_url: PROVIDER_URL
    };
}

export function sendOembed(query, res, isXML) {
    try {
        res.json(_getOembedData(query));
    } catch (e) {
        res.status(500).json({ code: 500, message: "Generating oembed failed", error: e.toString(), errorInfo: e.stack });
    }
}
