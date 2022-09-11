import { render, renderFile } from "ejs";
import { join } from "path";
import fetch from "node-fetch";

const ERROR_TEMPLATE = `<!DOCTYPE HTML>
<html>
<head>
    <meta charset="UTF-8" />
    <title>bembedfix - Error <%= code %>: <%= message %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:site_name" content="bembedfix" />
    <meta property="twitter:card" content="summary" />
    <meta property="og:url" content="<%= here %>" />
    <meta property="og:title" content="Error <%= code %> - <%= message %>" />
    <meta property="og:description" content="<%= data %>" />
    <meta property="twitter:title" content="Error <%= code %> - <%= message %>" />
    <meta property="twitter:description" content="<%= data %>" />
    <meta name="theme-color" content="#FF0000">
</head>
<body>
    <h1><%= code %> - <%= message %></h1>
    <p><pre><%= data %></pre></p>
</body>
</html>
`;
const PROJECT_URL = "https://github.com/Dobby233Liu/bembedfix";

function generateError(code, message, data, req) {
    let outData = data.toString();
    if (data.stack && data.message) {
        outData += "\n\n" + data.stack;
    }
    return render(ERROR_TEMPLATE,
        { code: code, message: message, data: outData, here: new URL(req.url, "https://" + req.headers.host).href }
    );
}

function sendTemplate(res, file, data, errorMessage, req) {
    renderFile(join(process.cwd(), file), data)
    .catch(function (err) {
        console.error(err);
        res
            .status(500)
            .send(generateError(500, errorMessage, err, req));
    })
    .then(out => res.send(out));
}

function getVideoURL(path) {
    let url = new URL(path, "https://b23.tv");
    if (url.pathname.startsWith("/video/"))
        url.hostname = "www.bilibili.com";
    return url;
}

async function checkVideoAndGetId(url) {
    if (url.pathname == "/")
        throw new Error("Not a video");

    let isBilibili = u => u.hostname.endsWith("bilibili.com") && u.pathname.startsWith("/video/");
    let getID = u => u.pathname.substring("/video/".length, u.pathname.length);

    if (isBilibili(url)) {
        return getID(url);
    }

    let response = await fetch(url);
    if (!response.ok)
        throw new Error("Got error while retrieving " + url + ": " + response.status);

    let resURLObj = new URL(response.url);
    if (isBilibili(resURLObj)) {
        return getID(resURLObj);
    }
    throw new Error("Not a video, got URL " + response.url);
}

function makeVideoPage(bvid) {
    return "https://www.bilibili.com/video/" + encodeURI(bvid);
}
function makeEmbedPlayer(bvid) {
    // //player.bilibili.com/player.html?aid=429619610&bvid=BV1GG411b7sc&cid=805522554&page=1
    return "https://player.bilibili.com/player.html?bvid=" + encodeURIComponent(bvid);
}
function makeEmbedPlayerHTML(bvid) {
    return `<iframe src="${makeEmbedPlayer(bvid)}" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>`;
}
function makeUserPage(mid) {
    return new URL(encodeURI("/" + mid), "https://space.bilibili.com");
}
async function getVideoData(id) {
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
        description: data.data.desc,
    };
}

export default function handler(req, res) {
    let parsableURL = new URL(req.url, "https://" + req.headers.host);
    if (parsableURL.pathname == "/favicon.ico") {
        res.redirect(301, "https://www.bilibili.com/favicon.ico");
        return;
    }
    if (parsableURL.pathname == "/oembed.json") {
        try {
            res.json({
                version: "1.0",
                type: req.query.type,
                url: makeVideoPage(req.query.bvid),
                html: makeEmbedPlayerHTML(req.query.bvid),
                width: 720,
                height: 480,
                thumbnail_url: req.query.pic,
                thumbnail_width: 720,
                thumbnail_height: 480,
                author_name: req.query.author,
                author_url: makeUserPage(req.query.mid),
                provider_name: "哔哩哔哩（bembedfix）",
                provider_url: "https://www.bilibili.com"
            });
        } catch (e) {
            res.status(500).json({ code: 500, message: "Generating oembed failed", error: e.toString(), errorInfo: e.stack });
        }
        return;
    }

    let videoURL;
    try {
        videoURL = getVideoURL(req.url);
    } catch (e) {
        // console.log(e);
        res.redirect(301, PROJECT_URL);
        return;
    }

    let videoID;
    // FIXME: preserve some queries
    checkVideoAndGetId(videoURL)
    .then(id => {
        getVideoData(id)
        .then(data => {
            data.oembed = new URL("/oembed.json", "https://" + req.headers.host).href;
            for (let i of ["author", "bvid", "thumbnail"])
                data[i + "_urlencoded"] = encodeURIComponent(data[i]);
            sendTemplate(res, "template.html", data, "An error ocurred while rendering the embed", req)
        })
        .catch(e => {
            // console.log(e);
            res
                .status(500)
                .send(generateError(500, "An error occurred while retrieving video information", e, req));
        });
    })
    .catch(e => {
        // console.log(e);
        res.redirect(301, PROJECT_URL);
    });
};
