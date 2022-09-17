from http.server import BaseHTTPRequestHandler
from contextlib import redirect_stdout
import yt_dlp
from urllib.parse import urlparse, parse_qsl

conf = {
    "outtmpl": "-",
    "format": "bestvideo*+bestaudio/best",
    "postprocessors": [{
        "key": "FFmpegVideoRemuxerPP",
        "preferedformat": "mp4"
    }],
    "retries": 0,
    "noplaylist": True
}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "video/mp4")
        self.end_headers()

        parsed = urlparse(f"http://fake{self.path}")
        path = parsed.path
        query = dict(parse_qsl(parsed.query))
        try:
            with redirect_stdout(self.wfile), yt_dlp.YoutubeDL(conf) as ydl:
                ydl.download("https://www.bilibili.com/video/" + query.bvid)
        except:
            pass

        return
