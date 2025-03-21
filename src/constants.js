export const MY_NAME = "bembedfix";
export const PROVIDER_NAME = `哔哩哔哩（${MY_NAME}）`;
export const PROVIDER_URL = "https://www.bilibili.com";

const PROJECT_URL = "https://github.com/Dobby233Liu/bembedfix";
export const PROJECT_HOMEPAGE_URL = PROJECT_URL + "?tab=readme-ov-file#readme";
export const PROJECT_ISSUES_URL = PROJECT_URL + "/issues/new";

export const FRIENDLY_USER_AGENT = `bembedfix/0.0 (+${PROJECT_URL})`;

export const ERROR_TEMPLATE = `<!DOCTYPE HTML>
<html>
<head>
    <meta charset="UTF-8" />
    <title><%= me %> - <%= code %>: <%= message %></title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:site_name" content="<%= me %>" />
    <meta property="twitter:card" content="summary" />
    <meta property="og:url" content="<%= here %>" />
    <meta property="og:title" content="<%= code %>: <%= message %>" />
    <meta property="og:description" content="<%= dataShort %>" />
    <meta property="twitter:title" content="<%= code %>: <%= message %>" />
    <meta property="twitter:description" content="<%= dataShort %>" />
    <meta name="theme-color" content="#FF0000">
</head>
<body>
    <h1><%= code %>: <%= message %></h1>
    <p><pre><%= data %></pre></p>
    <p>如果你认为这个错误是我们的问题，请在<a href="<%= issues_url %>">这里</a>报告它。</p>
</body>
</html>
`;

// TODO: Maybe make some of these RegExes in case of oddballs like The Lounge IRC Client (like Twitterbot)
export const CRAWLER_UAS = [
    "facebookexternalhit/1.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36 Twitterbot/1.0",
    "Twitterbot/1.0",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.57 Safari/537.36",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 11.6; rv:92.0) Gecko/20100101 Firefox/92.0",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (compatible; January/1.0; +https://gitlab.insrt.uk/revolt/january)",
    "Mozilla/5.0 (compatible; January/1.0; +https://github.com/revoltchat/january)",
    "Mozilla/5.0 (Windows; U; Windows NT 10.0; en-US; Valve Steam Client/default/1596241936; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36",
    "Mozilla/5.0 (Windows; U; Windows NT 10.0; en-US; Valve Steam Client/default/0; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.117 Safari/537.36",
    "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US; Valve Steam FriendsUI Tenfoot/0; ) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36",
    "BembedfixMetaTagDebugging (like test)",
    "Mozilla/5.0 (compatible; Schema-Markup-Validator; +https://validator.schema.org/)",
];

// This is for spoofing as a browser for bilibili API requests
export const FAKE_CLIENT_UA_HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0",
    "Sec-CH-UA":
        '"Chromium";v="134", "Not:A-Brand";v="24", "Microsoft Edge";v="134"',
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": '"Windows"',
};

// Set to null to disable
// TODO: Relocate to env vars?
export const COBALT_API_INSTANCE = null; // "https://cal1.coapi.ggtyler.dev";
// 7, 10
export const COBALT_API_VERSION = 10;
// To set an API key for cobalt API interactions, set the environment variable
// COBALT_API_KEY
