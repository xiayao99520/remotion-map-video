#!/usr/bin/env python3
"""Idempotent bootstrap for the tested Linux x86_64 map-video workspace."""
import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from downloads import download

parser = argparse.ArgumentParser()
parser.add_argument('--skill-root', default=os.environ.get('MAP_VIDEO_SKILL_ROOT'))
args = parser.parse_args()
root = Path(args.skill_root).resolve() if args.skill_root else Path(__file__).resolve().parent.parent
template = root / 'template'
cache = root / '.workspace-runtime'
cache.mkdir(parents=True, exist_ok=True)

def run(command, capture=False, **kwargs):
    return subprocess.run(command, check=True, text=True, capture_output=capture, **kwargs)

def browser_info():
    script = "console.log(JSON.stringify(require('./node_modules/@remotion/renderer/dist/browser/BrowserFetcher.js').getRevisionInfo('headless-shell')))"
    return json.loads(run(['node', '-e', script], capture=True, cwd=template).stdout)

if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'AMD64'):
    raise SystemExit('This bootstrap targets Linux x86_64; adapt OS packages and browser handling for other platforms.')
if sys.version_info < (3, 11):
    raise SystemExit('Python >=3.11 required for SHA256 file verification.')
for tool in ['node', 'npm', 'python3', 'dpkg-deb', 'fc-cache']:
    if not shutil.which(tool):
        raise SystemExit('Required executable missing: ' + tool)
version = run(['node', '-p', 'process.versions.node'], capture=True).stdout.strip()
if tuple(map(int, version.split('.')[:2])) < (22, 18):
    raise SystemExit('Node >=22.18 required; installed: ' + version)
if not (template / 'package-lock.json').is_file():
    raise SystemExit('Missing template/package-lock.json; install the original skill/template first.')
required = [template / 'node_modules/@remotion/cli/remotion-cli.js', template / 'public/maplibre-gl-worker.mjs', template / 'public/maplibre-gl-shared.mjs']
if not all(p.exists() for p in required):
    run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=template)
installed = json.loads((template / 'node_modules/@remotion/renderer/package.json').read_text())['version']
if installed != '4.0.534':
    raise SystemExit('Compatibility adapter verified for Remotion 4.0.534; revalidate before using another version.')

# 固定快照和对应 Packages 索引中的 SHA256；解包到私有缓存，不安装系统包。
snapshot = 'https://snapshot.ubuntu.com/ubuntu/20260828T000000Z/pool/'
packages = [
    ('fonts-wqy-microhei.deb', 'universe/f/fonts-wqy-microhei/fonts-wqy-microhei_0.2.0-beta-3.1_all.deb', 'fonts', '58d0a29af79ce1fc5c63b4276065f0fce27decf6839835f3f9c2e68d9f84ca20'),
    ('fonts-noto-color-emoji.deb', 'main/f/fonts-noto-color-emoji/fonts-noto-color-emoji_2.047-0ubuntu0.24.04.1_all.deb', 'fonts', 'b102b62ce6a7313315223cff5e052bdf8fc0ad162c9e961ce0dc2202bc139ce2'),
    ('libnss3-tools.deb', 'main/n/nss/libnss3-tools_3.98-1ubuntu0.2_amd64.deb', 'nss', 'e5b42390b02c21851bc04e9557ec48539a913f9b09637220c4b1db0d1386b3fb'),
]
for name, url_path, folder, sha256 in packages:
    deb = cache / name
    marker = cache / (name + '.extracted')
    # 已解包标记不能绕过下载缓存校验。
    download(snapshot + url_path, deb, sha256)
    if not marker.exists():
        run(['dpkg-deb', '-x', str(deb), str(cache / folder)])
        marker.touch()
font_target = Path.home() / '.local/share/fonts'
font_source = cache / 'fonts/usr/share/fonts'
for source in font_source.rglob('*'):
    if source.is_file():
        target = font_target / source.relative_to(font_source)
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copy2(source, target)
run(['fc-cache', '-f', str(font_target)])

# 只信任执行环境明确提供的 CA，保持证书验证；证书和代理地址不随 skill 分发。
ca_value = os.environ.get('NODE_EXTRA_CA_CERTS') or os.environ.get('SSL_CERT_FILE')
if ca_value:
    ca = Path(ca_value)
    if not ca.is_file():
        raise SystemExit('The environment-provided CA file does not exist.')
    certutil = str(cache / 'nss/usr/bin/certutil')
    db = Path.home() / '.pki/nssdb'
    db.mkdir(parents=True, exist_ok=True)
    database = 'sql:' + str(db)
    if not (db / 'cert9.db').exists():
        run([certutil, '-N', '-d', database, '--empty-password'])
    nickname = 'Workspace CA ' + hashlib.sha256(ca.read_bytes()).hexdigest()[:16]
    present = subprocess.run([certutil, '-L', '-d', database, '-n', nickname], capture_output=True)
    if present.returncode:
        run([certutil, '-A', '-d', database, '-n', nickname, '-t', 'C,,', '-i', str(ca)])

info = browser_info()
if not Path(info['executablePath']).is_file():
    try:
        run(['node', 'node_modules/@remotion/cli/remotion-cli.js', 'browser', 'ensure'], cwd=template, timeout=180)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        print('Browser downloader failed; fetching the same official URL through the environment proxy.', flush=True)
    info = browser_info()
    if not Path(info['executablePath']).is_file():
        archive = cache / 'chrome.zip'
        download(info['url'], archive)
        destination = Path(info['folderPath'])
        destination.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as z:
            for member in z.infolist():
                target = (destination / member.filename).resolve()
                if not target.is_relative_to(destination.resolve()):
                    raise SystemExit('Unsafe browser archive path.')
                z.extract(member, destination)
                if target.is_file() and member.external_attr >> 16 & 0o111:
                    target.chmod(target.stat().st_mode | 0o111)
        expected = destination / 'chrome-headless-shell-linux64'
        if not expected.exists():
            for name in ['chrome-linux', 'chromium-headless-shell-amazon-linux2023-x64']:
                source = destination / name
                if source.exists():
                    source.rename(expected)
                    break
        if (expected / 'chrome').exists() and not (expected / 'chrome-headless-shell').exists():
            (expected / 'chrome').rename(expected / 'chrome-headless-shell')
        info = browser_info()
browser = Path(info['executablePath'])
if not browser.is_file():
    raise SystemExit('Chrome executable not found after installation; inspect the downloaded archive layout.')
browser.chmod(browser.stat().st_mode | 0o111)
run([str(browser), '--version'])
(cache / 'browser-path.txt').write_text(str(browser) + '\n')
print('Bootstrap complete. Validate with a real short video before reporting rendering success.', flush=True)
