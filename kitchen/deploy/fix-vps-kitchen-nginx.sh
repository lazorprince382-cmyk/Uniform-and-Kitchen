#!/bin/bash
# Remove duplicate /kitchen/ nginx blocks and keep one correct proxy.
set -eu

CONF="/etc/nginx/sites-available/uniform-8088"

python3 <<'PY'
from pathlib import Path
import re

conf = Path("/etc/nginx/sites-available/uniform-8088")
text = conf.read_text(encoding="utf-8")

# Remove every existing /kitchen/ location block
text = re.sub(
    r"\n\s*location\s+\^~\s+/kitchen/\s*\{[^}]*\}",
    "",
    text,
    flags=re.DOTALL,
)
text = re.sub(
    r"\n\s*location\s+/kitchen/\s*\{[^}]*\}",
    "",
    text,
    flags=re.DOTALL,
)

block = """
    location ^~ /kitchen/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
"""

if "location / {" in text:
    text = text.replace("    location / {", block + "\n    location / {", 1)
else:
    text = text.rstrip() + block + "\n"

conf.write_text(text, encoding="utf-8")
print("OK: single kitchen block written to", conf)
PY

nginx -t
systemctl reload nginx
curl -s http://127.0.0.1:3002/api/health
echo ""
curl -s http://127.0.0.1:8088/kitchen/api/health
echo ""
curl -s -c /tmp/kitchen-test.cookies -b /tmp/kitchen-test.cookies \
  -X POST http://127.0.0.1:8088/kitchen/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"chef_full","password":"ChefFull1!"}' || true
echo ""
