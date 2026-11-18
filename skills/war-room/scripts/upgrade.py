#!/usr/bin/env python3
"""war-room 템플릿 업데이트를 프로젝트에 비교·반영한다 (references/upgrade.md).

사용:
  python3 upgrade.py check <프로젝트 war-room 폴더>
  python3 upgrade.py apply <프로젝트 war-room 폴더> [--drop 1,3]

check는 아무것도 쓰지 않고 요약만 출력한다. apply는 반영하고 기계 검사 결과를 출력한다.
--drop은 check가 번호를 붙인 "옮길 사용자 문장" 중 버릴 번호다.
종료 코드: 0 정상, 1 반영할 것 없음(버전 같음), 2 프로젝트가 더 새 버전, 3 멈춤(미커밋 변경·형식 오류).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(SKILL, 'template')
HISTORY = os.path.join(SKILL, 'template-history')
MARK = '# 프로젝트별 규칙'
ROLES = ('manager', 'evaluator')


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def split_role(text):
    """(템플릿 몫, 프로젝트 몫). 프로젝트 몫은 MARK 줄부터 끝까지. MARK가 없으면 None."""
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if line.strip() == MARK:
            return '\n'.join(lines[:i]), '\n'.join(lines[i:])
    return None


def counted(line):
    s = line.strip()
    return s if s and not s.startswith('#') and s != '---' else None


def frontmatter_model(text):
    m = re.match(r'^---\n(.*?)\n---', text, re.S)
    if not m:
        return None
    for line in m.group(1).split('\n'):
        if line.startswith('model:'):
            return line
    return None


def set_model(text, model_line):
    m = re.match(r'^---\n(.*?)\n---', text, re.S)
    if not m or model_line is None:
        return text
    body = m.group(1).split('\n')
    body = [l for l in body if not l.startswith('model:')]
    body.append(model_line)
    return '---\n' + '\n'.join(body) + '\n---' + text[m.end():]


def sections(text):
    """STATUS의 `## ` 절: [(제목 키, 제목 줄)]"""
    out = []
    for line in text.split('\n'):
        if line.startswith('## '):
            out.append((line[3:].split(' (')[0].strip(), line))
    return out


def plan(wr):
    """비교 결과. 파일을 쓰지 않는다."""
    p = {'notes': [], 'moves': [], 'roles': {}, 'blocked': []}
    try:
        pc = json.loads(read(os.path.join(wr, 'config.json')))
    except (OSError, json.JSONDecodeError) as e:
        p['blocked'].append(f'config.json을 읽을 수 없음: {e}')
        return p
    tc = json.loads(read(os.path.join(TEMPLATE, 'config.json')))
    p['pv'], p['tv'] = pc.get('templateVersion', 1), tc['templateVersion']
    p['config_add'] = [k for k in tc if k not in pc]

    for role in ROLES:
        path = os.path.join(wr, 'roles', f'{role}.md')
        if not os.path.exists(path):
            p['roles'][role] = None
            continue
        parts = split_role(read(path))
        if parts is None:
            p['blocked'].append(f'roles/{role}.md에 "{MARK}" 제목이 없음')
            continue
        tparts = split_role(read(os.path.join(TEMPLATE, 'roles', f'{role}.md')))
        current = {counted(l) for l in tparts[0].split('\n')} - {None}
        hist_path = os.path.join(HISTORY, f'{role}.txt')
        history = set(read(hist_path).split('\n')) if os.path.exists(hist_path) else set()
        old = 0
        # frontmatter는 템플릿 몫이다 (evaluator의 model 값은 apply에서 따로 지킨다)
        body = re.sub(r'^---\n.*?\n---\n?', '', parts[0], count=1, flags=re.S)
        for line in body.split('\n'):
            s = counted(line)
            if s is None or s in current:
                continue
            if s in history:
                old += 1
            else:
                p['moves'].append((role, s))
        target = set_model(tparts[0], frontmatter_model(parts[0])) if role == 'evaluator' else tparts[0]
        p['roles'][role] = {'changed': parts[0].strip() != target.strip(), 'old': old}

    ps = sections(read(os.path.join(wr, 'STATUS.md'))) if os.path.exists(os.path.join(wr, 'STATUS.md')) else []
    ts = sections(read(os.path.join(TEMPLATE, 'STATUS.md')))
    pkeys = {k: l for k, l in ps}
    p['status_add'] = [l for k, l in ts if k not in pkeys]
    p['status_retitle'] = [(pkeys[k], l) for k, l in ts if k in pkeys and pkeys[k] != l]

    root = os.path.dirname(os.path.abspath(wr))
    gi = os.path.join(root, '.gitignore')
    p['gitignore_add'] = not (os.path.exists(gi) and 'war-room/.eval/' in read(gi))
    p['root'] = root
    return p


def report(p):
    print(f"templateVersion: 프로젝트 {p['pv']} → 템플릿 {p['tv']}")
    for role, r in p['roles'].items():
        if r is None:
            print(f'roles/{role}.md: 없음 (바꾸지 않음)')
        else:
            n = sum(1 for m in p['moves'] if m[0] == role)
            state = '템플릿 부분 교체' if r['changed'] else '템플릿 부분 같음'
            print(f"roles/{role}.md: {state}, 옛 템플릿 문장 {r['old']}줄 버림, 사용자 문장 {n}줄 옮김")
    print('config.json: ' + (('키 추가 ' + ', '.join(p['config_add'])) if p['config_add'] else '추가할 키 없음')
          + (', templateVersion 갱신' if p['pv'] != p['tv'] else ''))
    print(f"STATUS.md: 절 추가 {len(p['status_add'])}개, 절 제목 설명 갱신 {len(p['status_retitle'])}개")
    print('.gitignore: ' + ('war-room/.eval/ 추가' if p['gitignore_add'] else '그대로'))
    if p['moves']:
        print('옮길 사용자 문장 (--drop 번호로 뺄 수 있음):')
        for i, (role, s) in enumerate(p['moves'], 1):
            print(f'  {i}. {role}.md: {s}')


def git_dirty(root, wr):
    try:
        out = subprocess.run(['git', '-C', root, 'status', '--porcelain', '--', os.path.relpath(wr, root), '.gitignore'],
                             capture_output=True, text=True)
    except OSError:
        return False
    return out.returncode == 0 and out.stdout.strip() != ''


def apply(wr, p, drop):
    root = p['root']
    if git_dirty(root, wr):
        print('멈춤: war-room/ 또는 .gitignore에 미커밋 변경이 있음')
        return 3
    backup = tempfile.mkdtemp(prefix='war-room-upgrade-')
    shutil.copytree(wr, os.path.join(backup, 'war-room'), ignore=shutil.ignore_patterns('.eval'))
    before_cfg = json.loads(read(os.path.join(wr, 'config.json')))
    keep = [m for i, m in enumerate(p['moves'], 1) if i not in drop]
    checks = []

    for role, r in p['roles'].items():
        if r is None:
            continue
        path = os.path.join(wr, 'roles', f'{role}.md')
        text = read(path)
        upper, proj = split_role(text)
        tupper, _ = split_role(read(os.path.join(TEMPLATE, 'roles', f'{role}.md')))
        new_upper = set_model(tupper, frontmatter_model(text)) if role == 'evaluator' else tupper
        moved = [s for rl, s in keep if rl == role]
        new_proj = proj.rstrip('\n')
        if moved:
            new_proj += '\n' + '\n'.join('- (템플릿 반영 때 옮김) ' + re.sub(r'^[-*]\s+', '', s) for s in moved)
        write(path, new_upper + '\n' + new_proj + '\n')
        after = split_role(read(path))[1]
        checks.append((f'{role}.md 프로젝트별 규칙 보존', after.startswith(proj.rstrip('\n'))))

    cfg_path = os.path.join(wr, 'config.json')
    cfg = json.loads(read(cfg_path))
    tc = json.loads(read(os.path.join(TEMPLATE, 'config.json')))
    merged = {}
    for k, v in tc.items():
        merged[k] = cfg[k] if k in cfg else v
    for k, v in cfg.items():
        if k not in merged:
            merged[k] = v
    merged['templateVersion'] = tc['templateVersion']
    write(cfg_path, json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
    after_cfg = json.loads(read(cfg_path))
    checks.append(('config.json 읽힘·roles 같음', after_cfg.get('roles') == before_cfg.get('roles')))

    st_path = os.path.join(wr, 'STATUS.md')
    if os.path.exists(st_path) and (p['status_add'] or p['status_retitle']):
        text = read(st_path)
        before_lines = len([l for l in text.split('\n') if l.strip()])
        for old, new in p['status_retitle']:
            text = text.replace(old, new, 1)
        tkeys = [k for k, _ in sections(read(os.path.join(TEMPLATE, 'STATUS.md')))]
        for line in p['status_add']:
            key = line[3:].split(' (')[0].strip()
            later = tkeys[tkeys.index(key) + 1:]
            pos = None
            for k, l in sections(text):
                if k in later:
                    pos = text.index(l)
                    break
            block = line + '\n\n- 없음\n\n'
            text = text[:pos] + block + text[pos:] if pos is not None else text.rstrip('\n') + '\n\n' + block
        write(st_path, text)
        after_lines = len([l for l in read(st_path).split('\n') if l.strip()])
        checks.append(('STATUS.md 내용 줄 줄지 않음', after_lines >= before_lines))

    if p['gitignore_add']:
        gi = os.path.join(root, '.gitignore')
        old = read(gi) if os.path.exists(gi) else ''
        write(gi, old + ('' if old.endswith('\n') or not old else '\n') + 'war-room/.eval/\n')

    print(f"반영함: 템플릿 {p['pv']} → {p['tv']}, 사용자 문장 {len(keep)}줄 옮김, {len(p['moves']) - len(keep)}줄 버림")
    for name, ok in checks:
        print(('✓ ' if ok else '✗ ') + name)
    print(f'반영 전 사본: {backup}')
    return 0 if all(ok for _, ok in checks) else 3


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('check', 'apply'):
        print(__doc__)
        return 3
    wr = os.path.abspath(sys.argv[2])
    p = plan(wr)
    if p['blocked']:
        for b in p['blocked']:
            print('멈춤: ' + b)
        return 3
    if p['pv'] > p['tv']:
        print(f"프로젝트 템플릿 {p['pv']}가 설치된 플러그인 템플릿 {p['tv']}보다 새 버전이다. 플러그인을 업데이트하세요.")
        return 2
    report(p)
    if sys.argv[1] == 'check':
        return 0 if p['pv'] < p['tv'] else 1
    drop = set()
    if '--drop' in sys.argv:
        drop = {int(x) for x in sys.argv[sys.argv.index('--drop') + 1].split(',') if x}
    return apply(wr, p, drop)


if __name__ == '__main__':
    sys.exit(main())
