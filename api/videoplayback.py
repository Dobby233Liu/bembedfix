from http.server import BaseHTTPRequestHandler
from contextlib import redirect_stdout
import yt_dlp
from urllib.parse import urlparse, parse_qsl
import traceback

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
        self.send_header("Content-Type", "application/octet-stream") #video/mp4")
        self.end_headers()

        parsed = urlparse(f"http://fake{self.path}")
        query = dict(parse_qsl(parsed.query))

        self.wfile.write(("Uber").encode())

        try:
            with redirect_stdout(self.wfile), yt_dlp.YoutubeDL(conf) as ydl:
                ydl.download("https://www.bilibili.com/video/" + query.bvid)
        except Exception:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            error_text = traceback.format_tb(exc_traceback)
            print(error_text, file=self.wfile)

        return
