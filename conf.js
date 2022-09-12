export const ERROR_TEMPLATE = `<!DOCTYPE HTML>
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
export const PROJECT_URL = "https://github.com/Dobby233Liu/bembedfix";
export const PROVIDER_NAME = "哔哩哔哩（bembedfix）";
export const PROVIDER_URL = "https://www.bilibili.com";