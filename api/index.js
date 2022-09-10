import { render, renderFile } from "ejs";
import { join } from 'path';
import fetch from 'node-fetch';

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
    var url = new URL(path, "https://b23.tv");
    if (url.pathname.startsWith("/video/"))
        url.host = "www.bilibili.com";
    return url;
}

function checkVideoValidity(url) {
    if (url.pathname == "/")
        return false;
    // TODO
    return;
}

module.exports = function (req, res) {
    var videoURL, videoAID;
    try {
        videoURL = getVideoURL(path);
        if (!checkVideoValidity(videoURL))
            throw new Error("Not a video");
    } catch (e) {
        // res.redirect(301, "https://github.com/Dobby233Liu/bembedfix");
        res.send("Under construction");
        return;
    }
    sendTemplate(res, "template.html", {}, "An error ocurred while rendering the embed");
};
