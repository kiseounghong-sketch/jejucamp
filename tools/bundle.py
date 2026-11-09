# 사용: python3 tools/bundle.py public jejucamp.html  (public/ 을 고친 뒤 한 파일 버전을 다시 만들 때)
# public/ 의 index.html + style.css + data.js + app.js 를 한 파일로 묶는다.
import base64, re, sys, os
pub = sys.argv[1]; out = sys.argv[2]
rd = lambda f: open(os.path.join(pub, f), encoding="utf-8").read()
html = rd("index.html")
icon = "data:image/png;base64," + base64.b64encode(open(os.path.join(pub, "icon-192.png"), "rb").read()).decode()

def sub1(s, old, new):
    assert s.count(old) == 1, old
    return s.replace(old, new)

html = sub1(html, '<link rel="manifest" href="manifest.json">\n', "")
html = sub1(html, '<link rel="icon" href="icon-192.png">', f'<link rel="icon" href="{icon}">')
html = sub1(html, '<link rel="apple-touch-icon" href="icon-192.png">', f'<link rel="apple-touch-icon" href="{icon}">')
html = sub1(html, '<link rel="stylesheet" href="style.css">', "<style>\n" + rd("style.css") + "</style>")
data = rd("data.js")
app = rd("app.js")
# 한 파일 버전에서는 서비스워커를 쓰지 않음
app = sub1(app, 'if("serviceWorker" in navigator){', 'if(false && "serviceWorker" in navigator){')
for name, code in (("data.js", data), ("app.js", app)):
    assert "</script" not in code.lower(), name
html = sub1(html, '<script src="data.js"></script>', "<script>\n" + data + "</script>")
html = sub1(html, '<script src="app.js"></script>', "<script>\n" + app + "</script>")
open(out, "w", encoding="utf-8").write(html)
print(out, len(html.encode("utf-8")), "bytes")
