import { render, renderFile } from "ejs";
import { join } from "path";
import fetch from "node-fetch";

const ERROR_TEMPLATE = `<!DOCTYPE HTML>
<html>
<head>
    <title>bembedfix - Error <%= code %>: <%= message %></title>
    <meta property="og:title" content="bembedfix - Error <%= code %>: <%= message %>" />
    <meta name="theme-color" content="#FF0000">
</head>
<body>
    <h1><%= code %> - <%= message %></h1>
    <p><pre><%= data %></pre></p>
</body>
</html>
`;
const PROJECT_URL = "https://github.com/Dobby233Liu/bembedfix";

function generateError(code, message, data) {
    return render(ERROR_TEMPLATE, { code: code, message: message, data: data });
}

function sendTemplate(res, file, data, errorMessage) {
    renderFile(join(process.cwd(), file), data)
    .catch(function (err) {
        console.error(err);
        res
            .status(500)
            .send(generateError(500, errorMessage, err));
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

    let resUrlObj = new URL(response.url);
    if (isBilibili(resUrlObj)) {
        return getID(resUrlObj);
    }
    throw new Error("Not a video, got URL " + response.url);
}

async function getVideoData(id) {
    let requestUrl = new URL("http://api.bilibili.com/x/web-interface/view");
    let idType = id.startsWith("BV") ? "bvid" : "aid";
    requestUrl.searchParams.append(idType, id.substring(2, id.length));

    let response = await fetch(requestUrl);
    let data = await response.json();
    if (!response.ok || data.code < 0)
        throw new Error(data);
  
    return {
        url: "https://www.bilibili.com/video/" + data.data.bvid,
        title: data.data.title,
        author: data.data.owner.name,
        upload_date: new Date(data.data.ctime).toISOString(),
        release_date: new Date(data.data.pubdate).toISOString(),
        thumbnail: data.data.pic,
        description: data.data.desc,
    };
}

export default function handler(req, res) {
    if (req.url == "/favicon.ico") {
        res.status(404);
        return;
    }

    let videoURL;
    try {
        videoURL = getVideoURL(req.url);
    } catch (e) {
        // console.log(e);
        // res.redirect(301, PROJECT_URL);
        res.send("Under construction");
        return;
    }

    let videoID;
    // FIXME: preserve some queries
    checkVideoAndGetId(videoURL)
    .then(id => {
        getVideoData(id)
        .then(data => sendTemplate(res, "template.html", data, "An error ocurred while rendering the embed"))
        .catch(e => {
            // console.log(e);
            res
                .status(500)
                .send(generateError(500, "An error occurred while retrieving video information", e));
        });
    })
    .catch(e => {
        // console.log(e);
        // res.redirect(301, PROJECT_URL);
        res.send("Under construction");
    });
};
