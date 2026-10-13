#!/usr/bin/env python3
"""Use the execution environment's proxy and its existing Chrome binary."""
import os
import sys
from pathlib import Path

root = Path(os.environ['MAP_VIDEO_SKILL_ROOT'])
browser = (root / '.workspace-runtime/browser-path.txt').read_text().strip()
args = sys.argv[1:]
proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy') or os.environ.get('HTTP_PROXY') or os.environ.get('http_proxy')
if proxy:
    # 只采用本次环境提供的代理，替换 Remotion 的直连参数；回环服务仍直连。
    args = [a for a in args if not a.startswith(('--no-proxy-server', '--proxy-server=', '--proxy-bypass-list='))]
    args += ['--proxy-server=' + proxy, '--proxy-bypass-list=localhost;127.0.0.1;[::1]']
os.execv(browser, [browser, *args])
