import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('checker', ROOT / 'scripts/check_template.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class TemplateChecks(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for path in ['README.md', 'AGENTS.md', 'LICENSE', 'template.config.json', 'specs', 'public', '.agents']:
            src, dst = ROOT / path, self.root / path
            shutil.copytree(src, dst) if src.is_dir() else shutil.copy2(src, dst)

    def write_config(self, **values):
        p = self.root / 'template.config.json'
        config = json.loads(p.read_text())
        config.update(values)
        p.write_text(json.dumps(config))

    def initialize(self, owner='cell'):
        self.write_config(stage='project', owner=owner, project={'name': 'Orbit Notes', 'summary': 'Local notes'})
        for name in ['README.md', 'specs/VISION.md']:
            p = self.root / name
            p.write_text(p.read_text().replace('{{PROJECT_NAME}}', 'Orbit Notes').replace('{{PROJECT_SUMMARY}}', 'Local notes'))

    def test_template_passes_but_not_project(self):
        self.assertEqual(checker.check(self.root), [])
        self.assertTrue(checker.check(self.root, True))

    def test_initialized_cell_project_passes(self):
        self.initialize()
        self.assertEqual(checker.check(self.root, True), [])

    def test_custom_author_can_replace_assets(self):
        self.initialize('custom')
        shutil.rmtree(self.root / 'public')
        p = self.root / 'README.md'
        s = p.read_text(); a=s.index('<!-- bip:creator:start -->'); b=s.index('<!-- bip:creator:end -->')
        p.write_text(s[:a]+'<!-- bip:creator:start -->\n## Author\nA different maker\n'+s[b:])
        self.assertEqual(checker.check(self.root, True), [])

    def test_owner_flag_alone_does_not_replace_author(self):
        self.initialize('custom')
        self.assertTrue(any('Custom author still references' in e for e in checker.check(self.root, True)))

    def test_accidental_qr_change_fails(self):
        (self.root / 'public/wetouch/wechat.webp').write_bytes(b'wrong image')
        self.assertTrue(any('Author asset changed' in e for e in checker.check(self.root)))

    def test_removed_author_section_fails(self):
        p=self.root/'README.md';s=p.read_text();a=s.index('<!-- bip:creator:start -->');b=s.index('<!-- bip:creator:end -->')
        p.write_text(s[:a]+s[b:])
        self.assertTrue(any('creator markers' in e for e in checker.check(self.root)))

    def test_missing_local_image_fails(self):
        (self.root/'public/wetouch/wechat-official.webp').unlink()
        self.assertTrue(any('Broken local link' in e for e in checker.check(self.root)))

    def test_placeholder_fails_in_project(self):
        self.initialize();p=self.root/'specs/VISION.md';p.write_text(p.read_text()+'\n{{PROJECT_NAME}}')
        self.assertTrue(any('placeholder' in e for e in checker.check(self.root, True)))

    def test_license_loss_fails(self):
        (self.root/'LICENSE').write_text('My license')
        self.assertTrue(any('MIT' in e for e in checker.check(self.root)))

    def test_paths_cannot_escape_repository(self):
        p=self.root/'README.md';p.write_text(p.read_text()+'\n[bad](../outside.md)')
        self.assertTrue(any('escapes repo' in e for e in checker.check(self.root)))

    def test_invalid_config_reports_error(self):
        (self.root/'template.config.json').write_text('[]')
        self.assertTrue(checker.check(self.root))


if __name__ == '__main__':
    unittest.main()
