import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from downloads import download


class DownloadTests(unittest.TestCase):
    def test_verified_download_then_verified_cache(self):
        content = b'fixed package contents'
        expected = hashlib.sha256(content).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'font.deb'
            with patch('urllib.request.urlopen', return_value=io.BytesIO(content)) as request:
                download('https://example.invalid/font.deb', target, expected)
                download('https://example.invalid/font.deb', target, expected)
                self.assertEqual(request.call_count, 1)
            self.assertEqual(target.read_bytes(), content)
            self.assertFalse(target.with_suffix('.deb.partial').exists())
            target.write_bytes(b'corrupted cache')
            with patch('urllib.request.urlopen') as request:
                with self.assertRaisesRegex(SystemExit, 'SHA256 mismatch'):
                    download('https://example.invalid/font.deb', target, expected)
                request.assert_not_called()

    def test_mismatched_download_never_becomes_cache(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'font.deb'
            with patch('urllib.request.urlopen', return_value=io.BytesIO(b'wrong package')):
                with self.assertRaisesRegex(SystemExit, 'SHA256 mismatch'):
                    download('https://example.invalid/font.deb', target, '0' * 64)
            self.assertFalse(target.exists())

    def test_environment_ca_keeps_https_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'font.deb'
            with patch.dict('os.environ', {'NODE_EXTRA_CA_CERTS': '/environment/ca.pem'}):
                with patch('ssl.create_default_context') as factory:
                    with patch('urllib.request.urlopen', return_value=io.BytesIO(b'package')) as request:
                        download('https://example.invalid/font.deb', target, hashlib.sha256(b'package').hexdigest())
                    factory.return_value.load_verify_locations.assert_called_once_with(cafile='/environment/ca.pem')
                    self.assertIs(request.call_args.kwargs['context'], factory.return_value)


if __name__ == '__main__':
    unittest.main()
