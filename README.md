# bembedfix

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FDobby233Liu%2Fbembedfix)

![demo](demo.png)

这是一个用于修复 bilibili 视频页面在 Discord 上的预览效果的小服务。效果如上图，一目了然，无需过多介绍。

> [!IMPORTANT]
> 由于本人目前对除视频以外的内容渲染没有需求，本应用的开发目前处于**维护模式**。

## 用法

使用很简单，只需要将您的视频链接中的 `www.bilibili.com` 或 `b23.tv` 换成 `bembedfix.vercel.app`，就可以啦。

**注意**：本服务目前只支持修复视频，而且不会保留例如空降时间的网址参数；本服务也不能处理需要登录才能显示的视频。

## 元数据类型

bembedfix 目前提供三种元数据：
-    [Open Graph](https://ogp.me/)
-    [oEmbed](https://oembed.com/)
      * 注意，本服务提供的 HTML 数据中调用 oEmbed API 的方式不符合标准
-    [Twitter Cards](https://developer.x.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
      * 如果用户代理为 Discordbot，这种元数据其中提供的 player MIME 会被谎报为 video/mp4，表现为
        客户端里视频封面上有播放按钮但是不能直接播放。见 #26

值得注意的是，本服务目前只在 Discord 和 Twitter 上正式受测试过。

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
