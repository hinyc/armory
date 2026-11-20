#!/usr/bin/env python3
"""기본 롤 템플릿의 지난 문장 목록을 만든다.

템플릿 반영(references/upgrade.md 3절)에서 프로젝트 롤 문서의 줄이
옛 템플릿 문장인지, 사용자가 쓴 문장인지 가르는 데 쓴다.
git 이력의 모든 버전과 작업 트리의 현재 버전에서 `# 프로젝트별 규칙` 위쪽 줄을 모은다.

사용: armory 저장소 루트에서 `python3 skills/war-room/template-history/build.py`
"""
import os
import subprocess

ROOT = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip()
HERE = os.path.join(ROOT, 'skills/war-room/template-history')
# 값이 목록이면 앞이 현재 경로, 뒤는 옛 경로 (git 이력을 모두 합친다)
FILES = {
    'manager': ['skills/war-room/template/roles/manager.md'],
    'evaluator': ['skills/war-room/template/roles/evaluator.md'],
    'commander': ['skills/war-room-commander/template/commander/commander.md',
                  'skills/war-room-commander/template/commander.md'],
    'po': ['skills/war-room-commander/template/commander/roles/po.md'],
    'pm': ['skills/war-room-commander/template/commander/roles/pm.md'],
    'tpm': ['skills/war-room-commander/template/commander/roles/tpm.md'],
    'places': ['skills/war-room/template/PLACES.md'],
}
MARK = '# 프로젝트별 규칙'


def upper_lines(text):
    out = set()
    for line in text.split('\n'):
        if line.strip() == MARK:
            break
        s = line.strip()
        if s and not s.startswith('#') and s != '---':
            out.add(s)
    return out


def head_lines(text):
    """PLACES.md 머리말의 `> - ` 줄 (upgrade.py가 옛 머리말을 알아보는 데 쓴다)."""
    return {l.strip() for l in text.split('\n') if l.startswith('> - ')}


for name, paths in FILES.items():
    extract = head_lines if name == 'places' else upper_lines
    lines = set()
    for path in paths:
        revs = subprocess.check_output(['git', '-C', ROOT, 'log', '--format=%H', '--', path], text=True).split()
        for rev in revs:
            shown = subprocess.run(['git', '-C', ROOT, 'show', f'{rev}:{path}'], capture_output=True, text=True)
            if shown.returncode == 0:
                lines |= extract(shown.stdout)
        full = os.path.join(ROOT, path)
        if os.path.exists(full):
            with open(full, encoding='utf-8') as f:
                lines |= extract(f.read())
    with open(os.path.join(HERE, f'{name}.txt'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(sorted(lines)) + '\n')
    print(f'{name}.txt: {len(lines)} lines')
