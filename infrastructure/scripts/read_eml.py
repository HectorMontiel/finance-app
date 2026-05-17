import re, html as html_mod
with open(r"D:\Descargas\Tu compra ha sido registrada..eml", encoding="utf-8", errors="replace") as f:
    content = f.read()
body = content[content.find("<!DOCTYPE"):]
body = re.sub(r"<(style|script)[^>]*>.*?</\1>", " ", body, flags=re.DOTALL|re.IGNORECASE)
body = re.sub(r"<[^>]+>", " ", body)
body = html_mod.unescape(body)
body = re.sub(r"\s+", " ", body).strip()
print(body[:2000])
