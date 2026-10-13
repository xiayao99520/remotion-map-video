"""下载到临时文件；固定包及已有缓存都必须先通过 SHA256 校验。"""
import hashlib
import os
import shutil
import ssl
import urllib.request


def verify_sha256(path, expected):
    if expected is None:
        return
    with path.open('rb') as source:
        actual = hashlib.file_digest(source, 'sha256').hexdigest()
    if actual != expected:
        raise SystemExit(f'SHA256 mismatch for {path.name}: expected {expected}, got {actual}. Stop; remove the invalid cache file before retrying.')


def download(url, destination, sha256=None):
    if destination.is_file() and destination.stat().st_size:
        verify_sha256(destination, sha256)
        return
    partial = destination.with_suffix(destination.suffix + '.partial')
    print('Downloading ' + destination.name, flush=True)
    context = ssl.create_default_context()
    ca = os.environ.get('NODE_EXTRA_CA_CERTS')
    if ca:
        context.load_verify_locations(cafile=ca)
    with urllib.request.urlopen(url, context=context, timeout=180) as response, partial.open('wb') as output:
        shutil.copyfileobj(response, output)
    # 校验通过才替换正式缓存，失败的下载不会成为下次的可信输入。
    verify_sha256(partial, sha256)
    partial.replace(destination)
