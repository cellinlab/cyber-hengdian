#!/usr/bin/env python3
"""Read-only checks for the BIP template and initialized projects; stdlib only."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def check(root, require_project=False):
    root = Path(root).resolve()
    errors = []
    try:
        config = json.loads((root / 'template.config.json').read_text())
        readme = (root / 'README.md').read_text()
        license_text = (root / 'LICENSE').read_text()
    except (OSError, ValueError) as exc:
        return [f'Cannot read template inputs: {exc}']
    if not isinstance(config, dict):
        return ['Config must be an object']
    stage, owner = config.get('stage'), config.get('owner')
    if stage not in ('template', 'project'):
        errors.append('stage must be template or project')
    if owner not in ('cell', 'custom'):
        errors.append('owner must be cell or custom')
    sections = {}
    for name in ('project', 'creator'):
        start, end = f'<!-- bip:{name}:start -->', f'<!-- bip:{name}:end -->'
        if readme.count(start) != 1 or readme.count(end) != 1 or readme.find(start) >= readme.find(end):
            errors.append(f'Invalid README {name} markers')
        else:
            sections[name] = (readme.index(start), readme.index(end))
    if len(sections) == 2 and sections['project'][1] >= sections['creator'][0]:
        errors.append('README sections overlap or are out of order')
    for text in ('Copyright (c) 2026 cell', 'Permission is hereby granted, free of charge',
                 'The above copyright notice and this permission notice shall be included',
                 'THE SOFTWARE IS PROVIDED "AS IS"'):
        if text not in license_text:
            errors.append('Missing original MIT declaration: ' + text)
    if owner == 'cell':
        cell = config.get('cell', {})
        if not isinstance(cell, dict) or not isinstance(cell.get('links'), list) or not isinstance(cell.get('assets'), dict):
            errors.append('Cell profile must contain links and assets')
        else:
            creator = readme[slice(*sections['creator'])] if 'creator' in sections else ''
            for url in cell['links']:
                if not isinstance(url, str) or url not in creator:
                    errors.append(f'Missing Cell author link: {url}')
            for path, expected in cell['assets'].items():
                target = (root / path).resolve()
                if not target.is_relative_to(root):
                    errors.append(f'Asset path escapes repo: {path}')
                elif not target.is_file():
                    errors.append(f'Missing author asset: {path}')
                elif hashlib.sha256(target.read_bytes()).hexdigest() != expected:
                    errors.append(f'Author asset changed; verify intended update and profile hash: {path}')
    if owner == 'custom' and 'creator' in sections:
        creator = readme[slice(*sections['creator'])]
        # Changing the owner flag alone must not leave Cell's contact/payment images in place.
        for path in ('public/wetouch/wechat.webp', 'public/wetouch/wechat-channels.webp',
                     'public/wetouch/wechat-official.webp', 'public/sponsor/wx.webp', 'public/sponsor/zfb.webp'):
            if path in creator:
                errors.append(f'Custom author still references Cell contact/sponsor asset: {path}')
    for doc in [root / 'README.md', root / 'AGENTS.md', root / 'specs/VISION.md',
                root / '.agents/skills/init-bip-project/SKILL.md']:
        if not doc.is_file():
            errors.append(f'Missing document: {doc.relative_to(root)}')
            continue
        text = doc.read_text()
        # Check Markdown and HTML link destinations, not command examples or remote URLs.
        refs = re.findall(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)', text)
        refs += re.findall(r'(?:src|href)="([^"]+)"', text)
        for ref in refs:
            url = urlsplit(ref.strip('<>'))
            if url.scheme or url.netloc or not url.path:
                continue
            target = (doc.parent / unquote(url.path)).resolve()
            if not target.is_relative_to(root):
                errors.append(f'Local link escapes repo: {ref}')
            elif not target.exists():
                errors.append(f'Broken local link in {doc.relative_to(root)}: {ref}')
        if (require_project or stage == 'project') and doc.name in ('README.md', 'VISION.md'):
            if re.search(r'\{\{PROJECT_[A-Z_]+\}\}', text):
                errors.append(f'Unfilled project placeholder in {doc.relative_to(root)}')
    if require_project and stage != 'project':
        errors.append('--project requires stage: project')
    if require_project or stage == 'project':
        project = config.get('project')
        if not isinstance(project, dict) or any(not isinstance(project.get(k), str) or not project[k].strip()
                                               for k in ('name', 'summary')):
            errors.append('Initialized project needs nonempty name and summary')
        elif 'project' in sections and project['name'] not in readme[slice(*sections['project'])]:
            errors.append('Project name is absent from README project section')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', action='store_true', help='Require initialized project content')
    args = parser.parse_args()
    errors = check(ROOT, args.project)
    for error in errors:
        print('ERROR:', error)
    if errors:
        return 1
    print('Template/project structure, local links, MIT declaration and configured author assets passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
