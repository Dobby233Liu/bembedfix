import { render, renderFile } from "ejs";
import { join } from "path";
import fetch from "node-fetch";

const ERROR_TEMPLATE = `
<!DOCTYPE HTML>
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
    renderFile(join(process.cwd(), file))
    .catch(function (err) {
        console.error(err);
        res
            .status(500)
            .send(generateError(500, errorMessage, err));
    })
    .then(data => res.send(data));
}

function getVideoURL(path) {
    let url = new URL(path, "https://b23.tv");
    if (url.pathname.startsWith("/video/"))
        url.host = "www.bilibili.com";
    return url;
}

async function checkVideoAndGetId(url) {
    if (url.pathname == "/")
        throw new Error("Not a video");

    let isBilibili = u => u.host.endsWith("bilibili.com") && u.pathname.startsWith("/video/");
    let getID = u => u.pathname.substring("/video/".length, u.pathname.length);

    if (isBilibili(url))
    {
        return getID(url);
    }

    let response = await fetch(url);
    if (!response.ok)
        throw new Error("Got error while retrieving " + url + ": " + response.status);

    if (isBilibili(response.url))
    {
        return getID(response.url);
    }
    throw new Error("Not a video, got URL " + response.url);
}

async function getVideoData(id) {
  // TODO
  return {};
}

export default function handler(req, res) {
    let videoURL;
    try {
        videoURL = getVideoURL(path);
    } catch (e) {
        // res.redirect(301, PROJECT_URL);
        res.send(e);//"Under construction");
        return;
    }

    let videoID;
    checkVideoAndGetId(videoURL)
    .catch(e => {
        // res.redirect(301, PROJECT_URL);
        res.send(e);//"Under construction");
    })
    .then(getVideoData)
    .catch(e => {
        console.error(e);
        res
            .status(500)
            .send(generateError(500, "An error occurred while retrieving video information", e));
    })
    .then(data => sendTemplate(res, "template.html", data, "An error ocurred while rendering the embed"));
};
