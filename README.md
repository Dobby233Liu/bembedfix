# bembedfix

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDobby233Liu%2Fbembedfix)

这是一个用于修复 bilibili 视频页面在 Discord 上的预览效果的小服务。效果如下图，一目了然，无需过多介绍。

![demo](demo.jpg)

<!--
> [!IMPORTANT]
> 由于本人目前对除视频以外的内容渲染没有需求，本应用的开发目前处于**维护模式**。
-->

## 用法

> [!NOTE]
> 本服务目前只支持修复视频，而且不会保留大多数网址参数；本服务也不能处理需要登录才能显示的视频。

您可以任选一种方法：

1.  将想要嵌入的视频的链接中的 `www.bilibili.com` 或 `b23.tv`（对于移动端分享短链而言）
    替换为 `bembedfix.vercel.app`；
2.  在 `https://bembedfix.vercel.app/` 后面附上要嵌入的视频的 `BV` 或 `av` 号；

然后在您所在的平台上发送新获得的链接，bembedfix 就会起作用啦。（但愿如此。）

> [!WARNING]
> 鉴于 `b23.tv` 短链[有时效限制][bac-b23tv-summary]，通过它们生成的 bembedfix
> 链接也极可能同样失效。因此对于需要经常访问的视频，强烈建议**不要**使用这样的链接。

> [!TIP]
> 在 Android 客户端的视频详情页，您可以点击视频标题以展开简介。
> 这时长按标题下方的 `BVxxxxxxxxxx` 或 `avxxxxxxxxxx` 字符串，
> 可以复制当前视频对应的 `BV` 或 `av` 号。

[bac-b23tv-summary]: https://socialsisteryi.github.io/bilibili-API-collect/docs/misc/b23tv.html#简述

## 元数据类型

bembedfix 目前提供三种元数据：

-   [Open Graph](https://ogp.me/)
-   [oEmbed](https://oembed.com/)
    -   注意，本服务提供的 HTML 数据中调用 oEmbed API 的方式不符合标准
-   [Twitter Cards](https://developer.x.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)

> [!WARNING]
> 如果用户代理为 Discordbot，Twitter Cards 元数据中提供的 player MIME 类型会被谎报为 video/mp4，
> 其表现为客户端里视频封面上有播放按钮但是不能直接播放。
>
> 自行运营此代码库的用户可以将 `src/constants.js` 中的 `COBALT_API_INSTANCE` 改为一个可用的
> [cobalt](https://github.com/imputnet/cobalt) API 实例以让它提供视频流。鉴于一个神奇的响应速度问题，
> 加上 cobalt 不能正确解析多P视频，这个功能目前在 `bembedfix.vercel.app` 被禁用。
>
> 详情见 [#26][issue-26]

注意，本服务目前只在 Discord 和 Twitter 上正式受测试过。

[issue-26]: https://github.com/Dobby233Liu/bembedfix/issues/26

## 特别鸣谢

-   本项目灵感来源于 [TwitFix](https://github.com/dylanpdx/BetterTwitFix)，我也对其代码做了参考。
-   与 B 站 API 交互的代码参考了 [哔哩哔哩-API 收集整理](https://github.com/SocialSisterYi/bilibili-API-collect)。
-   [@狸花十七](https://space.bilibili.com/5490502) 的视频——确切来说是上图中的那则视频——导致我产生了开坑这个项目的想法。
-   [BEMYPET][bemypet-kr]（[似了的 bilibili 账号][bemypet-cn-bili]）产生的内容在本项目开发过程中对我造成了一定心理创伤。（误）
-   我还可以加人吗？

[bemypet-kr]: https://www.youtube.com/@bemypet
[bemypet-cn-bili]: https://space.bilibili.com/1677731862

## 许可证

[MIT License](LICENSE)
