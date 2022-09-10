import { render, renderFile } from "ejs";
import { join } from 'path';

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

module.exports = function (req, res) {
    var redirLoc = new URL(req.url, "https://totally-exists.example").pathname.trim();
    if (redirLoc == "/") {
        res.send("e");
        return;
    }
    sendTemplate(res, "template.html", {}, "An error ocurred while rendering the embed");
};
