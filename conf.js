export const ERROR_TEMPLATE = `<!DOCTYPE HTML>
<html>
<head>
    <meta charset="UTF-8" />
    <title>bembedfix - <%= code %>: <%= message %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:site_name" content="bembedfix" />
    <meta property="twitter:card" content="summary" />
    <meta property="og:url" content="<%= here %>" />
    <meta property="og:title" content="<%= code %>: <%= message %>" />
    <meta property="og:description" content="<%= data %>" />
    <meta property="twitter:title" content="<%= code %>: <%= message %>" />
    <meta property="twitter:description" content="<%= data %>" />
    <meta name="theme-color" content="#FF0000">
</head>
<body>
    <h1 id="message"><%= code %>: <%= message %></h1>
    <p><pre id="error"><%= data %></pre></p>
    <p id="report">如果你认为这个错误是我们的问题，请在<a href="<%= issues_url %>">这里</a>报告 bug。</p>
</body>
</html>
`;

export const PROJECT_URL = "https://github.com/Dobby233Liu/bembedfix";
export const PROJECT_ISSUES_URL = "https://github.com/Dobby233Liu/bembedfix/issues/new";

export const PROVIDER_NAME = "哔哩哔哩（bembedfix）";
export const PROVIDER_URL = "https://www.bilibili.com";

export const CRAWLER_UAS = [
    "facebookexternalhit/1.1",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36",
    "Mozilla/5.0 (Windows; U; Windows NT 10.0; en-US; Valve Steam Client/default/1596241936; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36",
    "Mozilla/5.0 (Windows; U; Windows NT 10.0; en-US; Valve Steam Client/default/0; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36", 
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0", 
    "facebookexternalhit/1.1",
    "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US; Valve Steam FriendsUI Tenfoot/0; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36", 
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)", 
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0", 
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)", 
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (compatible; January/1.0; +https://gitlab.insrt.uk/revolt/january)",
    "!! Meta Tag Debugging !! (like test)"
];
