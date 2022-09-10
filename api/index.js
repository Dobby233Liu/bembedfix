import { render, renderFile } from "ejs";

const ERROR_TEMPLATE = `
<!DOCTYPE HTML>
<head>
    <title>bembedfix - Error <%= code %>: <%= message %></title>
    <meta property="og:title" content="bembedfix - Error <%= code %>: <%= message %>" />
    <meta name="theme-color" content="#FF0000">
</head>
<body>
    <h1><%= code %> - <%= message %></h1>
    <p><pre><%= data %></pre></p>
</body>
`;

function generateError(code, message, data) {
    return render(ERROR_TEMPLATE, { code: code, message: message, data: data });
}

module.exports = function (req, res) {
    renderFile("template.html")
    .catch(function (err) {
        console.error(err);
        res
            .status(500)
            .send(generateError(500, "An error ocurred while rendering the embed", err));
    })
    .then(data => res.send(data));
};
