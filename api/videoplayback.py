from http.server import BaseHTTPRequestHandler
from contextlib import redirect_stdout, redirect_stderr
import yt_dlp
from urllib.parse import urlparse, parse_qsl
import traceback
import sys
import io

conf = {
    "outtmpl": "-",
    "logtostderr": True,
    "format": "bestvideo*+bestaudio/best",
    "postprocessors": [{
        "key": "FFmpegVideoRemuxer",
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
        query = dict(parse_qsl(parsed.query))

        try:
            with redirect_stdout(self.wfile), redirect_stderr(io.StringIO()), yt_dlp.YoutubeDL(conf) as ydl:
                ydl.download("https://www.bilibili.com/video/" + query["bvid"])
        except Exception:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            error_text = traceback.format_tb(exc_traceback)
            self.wfile.write(error_text.encode())

        return
