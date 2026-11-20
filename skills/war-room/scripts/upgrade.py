#!/usr/bin/env python3
"""war-room 템플릿 업데이트를 프로젝트에 비교·반영한다 (references/upgrade.md).

사용:
  python3 upgrade.py check <프로젝트 war-room 폴더>
  python3 upgrade.py apply <프로젝트 war-room 폴더> [--drop 1,3]
  python3 upgrade.py places <프로젝트 war-room 폴더>

check는 아무것도 쓰지 않고 요약만 출력한다. apply는 반영하고 기계 검사 결과를 출력한다.
--drop은 check가 번호를 붙인 "옮길 사용자 문장" 중 버릴 번호다.
places는 버전과 상관없이 장소 목록만 옮긴다: war-room/PLACES.md가 없으면 만들고, 옛 commander/PLACES.md 줄을
합친 뒤 지우고, 감독 파일의 옛 경로 글자를 바꾼다 (감독 지정·이어받기 때. apply도 같은 일을 한다).
옛 파일에 형식 밖 줄(`* ` 불릿, 이어지는 줄, 절 밖 메모)이 있으면 옛 파일을 지우지 않고 그 줄을 보이고 ✗로 끝난다
(apply는 다른 반영은 그대로 한다).
종료 코드: 0 정상, 1 반영할 것 없음(버전 같음, places는 옮길 것 없음), 2 프로젝트가 더 새 버전,
3 멈춤(미커밋 변경·형식 오류) 또는 검사 ✗(옛 장소 목록에 옮기지 못한 줄이 남음 등).
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
# 감독 템플릿은 war-room-commander 스킬에 있다 (PLACES_REFS와 같은 SKILL 기준 해석). (프로젝트 war-room 기준 경로, 대조 목록 이름)
COMMANDER_TEMPLATE = os.path.join(os.path.dirname(SKILL), 'war-room-commander', 'template', 'commander')
COMMANDER_FILES = (
    (os.path.join('commander', 'commander.md'), 'commander'),
    (os.path.join('commander', 'roles', 'po.md'), 'po'),
    (os.path.join('commander', 'roles', 'pm.md'), 'pm'),
    (os.path.join('commander', 'roles', 'tpm.md'), 'tpm'),
)
# 템플릿 4판부터 maxAttempts 기본값이 3에서 1로 바뀌었다 (references/upgrade.md 4절)
ATTEMPTS_RESET_BEFORE = 4
OLD_MAX_ATTEMPTS = 3


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


def frontmatter_lines(text):
    m = re.match(r'^---\n(.*?)\n---', text, re.S)
    return [l.strip() for l in m.group(1).split('\n') if l.strip()] if m else []


def dropped_frontmatter(upper, tupper, history, keep_model):
    """새 템플릿으로 가면서 사라지는 프로젝트 frontmatter 줄의 키 목록.
    새 템플릿에 같은 줄이 있거나, 옛 템플릿 줄(history)이거나, 지키는 model 줄이면 세지 않는다."""
    current = set(frontmatter_lines(tupper))
    out = []
    for l in frontmatter_lines(upper):
        if l in current or l in history or (keep_model and l.startswith('model:')):
            continue
        out.append(l.split(':')[0].strip() if ':' in l else l)
    return out


def dropped_note(keys):
    return f", 머리말 줄 {len(keys)}개 버림({', '.join(keys)})" if keys else ''


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


def header(text):
    """STATUS 첫 `## ` 절 앞의 `>` 설명 줄들."""
    head = text.split('\n## ', 1)[0]
    return [l for l in head.split('\n') if l.startswith('>')]


PLACES = 'PLACES.md'
OLD_PLACES = os.path.join('commander', 'PLACES.md')
# 장소 목록 경로를 가리키는 감독 파일 (옛 경로 글자를 새 경로로 바꾼다)
PLACES_REFS = ('COMMAND.md', os.path.join('commander', 'commander.md'),
               os.path.join('commander', 'roles', 'po.md'), os.path.join('commander', 'roles', 'pm.md'),
               os.path.join('commander', 'roles', 'tpm.md'))
# 예전 판 감독 템플릿 commander/PLACES.md에만 있던 고정 문구 (현재 템플릿 PLACES.md와 다른 줄)
OLD_PLACES_TEMPLATE = (
    '# 감독 장소 목록',
    '> 이 프로젝트에서 반복해 쓰는 위치(파일·폴더 경로, 깃 저장소·이슈, 지라 사이트·프로젝트 키·보드, 문서 URL, '
    '자주 쓰는 명령)의 원본이다. 감독이 "그 파일 옮겨", "그 깃 이슈 가져와", "지라 업데이트해"처럼 위치가 빠진 요청을 받으면, '
    'po가 요청 속 표현으로 이 파일을 grep해 걸린 줄만 읽고 실제 위치로 바꾼다. 감독은 이 파일을 읽지 않고, 찾은 실제 위치를 '
    '`[감독 지시]`·위임 프롬프트에 넣는다. 작업 세션과 작업을 맡은 하위 에이전트는 이 파일을 읽지 않는다 '
    '(읽는 것은 감독 롤 po·pm·tpm뿐이고 범위는 `war-room-commander` 스킬 6절).',
    '> - 쓰기: 감독 롤 pm(`commander/roles/pm.md`)만 쓴다. 사용자가 확인한 위치만 적는다. 추측한 값은 적지 않는다.',
    '> - 못 찾거나 여러 줄이 걸리면 감독이 사용자에게 묻고, 답을 받으면 pm이 적는다.',
    '> - 낡은 위치(경로 없음·접근 실패)는 tpm이나 작업 보고로 알게 되면 감독이 사용자에게 확인하고, '
    '확인받은 뒤 pm이 고친다. 고친 줄은 `확인한 날`을 바꾼다.',
)


# 머리말 줄의 시작 낱말: 옛 줄과 새 템플릿 줄을 짝짓는다
PLACES_HEAD_KEYS = ('> - 쓰기:', '> - 못 찾거나', '> - 낡은 위치')


def places_head_swaps(text):
    """프로젝트 PLACES.md 머리말 줄 중 옛 템플릿 문구 그대로인 줄 → 새 템플릿 줄. [(옛 줄, 새 줄)].
    옛 문구는 template-history/places.txt (build.py가 git 이력에서 모은다). 사용자가 고친 줄은 건드리지 않는다."""
    hist_path = os.path.join(HISTORY, 'places.txt')
    history = set(read(hist_path).split('\n')) if os.path.exists(hist_path) else set()
    new = {k: l for k in PLACES_HEAD_KEYS for l in read(os.path.join(TEMPLATE, PLACES)).split('\n') if l.startswith(k)}
    out = []
    for line in text.split('\n'):
        key = next((k for k in PLACES_HEAD_KEYS if line.startswith(k)), None)
        if key and key in new and line.rstrip() != new[key] and line.rstrip() in history:
            out.append((line.rstrip(), new[key]))
    return out


def place_template_lines():
    """템플릿 고정 문구: 현재 템플릿 PLACES.md와 예전 판 commander/PLACES.md의 줄 (앞뒤 공백 뺌)."""
    lines = {l.strip() for l in read(os.path.join(TEMPLATE, PLACES)).split('\n')}
    return lines | set(OLD_PLACES_TEMPLATE)


def place_stray(text):
    """옮길 수 없는 의미 있는 줄: 데이터 줄·빈 줄·주석·`## ` 절 제목·템플릿 고정 문구가 아닌 줄.
    `* ` 불릿, 데이터 줄 아래 이어지는 줄, 절 밖 메모가 여기 걸린다. 걸리면 옛 파일을 지우지 않는다."""
    rows = {l for _, l in place_rows(text)}
    fixed = place_template_lines()
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    return [l.rstrip() for l in text.split('\n')
            if l.strip() and not l.startswith('## ') and l.rstrip() not in rows and l.strip() not in fixed]


def place_rows(text):
    """장소 목록의 데이터 줄: [(절 제목, 줄)]. 주석과 `- 없음`은 뺀다."""
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    rows, sec = [], None
    for line in text.split('\n'):
        if line.startswith('## '):
            sec = line[3:].strip()
        elif sec and line.startswith('- ') and line.strip() != '- 없음':
            rows.append((sec, line.rstrip()))
    return rows


def place_key(line):
    return line[2:].split(' · ')[0].strip()


def place_date(line):
    last = line.split(' · ')[-1].strip()
    return last if re.fullmatch(r'\d{4}-\d{2}-\d{2}', last) else ''


def places_plan(wr):
    """장소 목록 이전 계획. 파일을 쓰지 않는다."""
    new, old = os.path.join(wr, PLACES), os.path.join(wr, OLD_PLACES)
    q = {'create': not os.path.exists(new), 'merge': os.path.exists(old), 'add': [], 'replace': [], 'keep': [],
         'refs': [], 'stray': [], 'head': []}
    if os.path.exists(new):
        q['head'] = places_head_swaps(read(new))
    if q['merge']:
        base = read(new) if os.path.exists(new) else read(os.path.join(TEMPLATE, PLACES))
        have = {place_key(l): l for _, l in place_rows(base)}
        q['stray'] = place_stray(read(old))
        for sec, line in place_rows(read(old)):
            cur = have.get(place_key(line))
            if cur is None:
                q['add'].append((sec, line))
                have[place_key(line)] = line
            elif cur != line:
                # 같은 부르는 말: 확인한 날이 더 늦은 줄을 남긴다. 같거나 모르면 war-room/PLACES.md 줄을 남긴다
                (q['replace'] if place_date(line) > place_date(cur) else q['keep']).append((cur, line))
    for rel in PLACES_REFS:
        path = os.path.join(wr, rel)
        if os.path.exists(path) and 'commander/PLACES.md' in read(path):
            q['refs'].append(rel)
    return q


def places_report(q):
    if not (q['create'] or q['merge'] or q['refs'] or q['head']):
        print('PLACES.md: 그대로')
        return
    parts = ['새로 만듦'] if q['create'] else []
    if q['head']:
        parts.append(f"머리말 {len(q['head'])}줄 새 문구로")
    if q['merge']:
        parts.append(f"commander/PLACES.md에서 줄 {len(q['add'])}개 옮김, 같은 부르는 말 {len(q['replace'])}개 새 줄로 바꿈"
                     f", {len(q['keep'])}개는 PLACES.md 줄 유지, "
                     + (f"옮기지 못한 줄 {len(q['stray'])}개라 commander/PLACES.md 남김" if q['stray']
                        else 'commander/PLACES.md 지움'))
    if q['refs']:
        parts.append('감독 파일의 옛 경로 글자 바꿈: ' + ', '.join(q['refs']))
    print('PLACES.md: ' + '; '.join(parts))
    for cur, line in q['replace']:
        print(f'  바꿈: {cur}  →  {line}')
    for cur, line in q['keep']:
        print(f'  버림 (확인한 날이 같거나 이르다): {line}  (남긴 줄: {cur})')
    for line in q['stray']:
        print(f'  옮기지 못함 (형식 밖 줄. 손으로 war-room/PLACES.md에 옮긴 뒤 commander/PLACES.md를 지운다): {line}')


def places_apply(wr, q):
    """장소 목록을 war-room/PLACES.md로 만들고 옛 commander/PLACES.md를 합친다. (이름, 통과) 검사를 돌려준다."""
    new, old = os.path.join(wr, PLACES), os.path.join(wr, OLD_PLACES)
    if q['create']:
        shutil.copyfile(os.path.join(TEMPLATE, PLACES), new)
    checks = []
    if q['head']:
        swap = dict(q['head'])
        write(new, '\n'.join(swap.get(l.rstrip(), l) for l in read(new).split('\n')))
        left = places_head_swaps(read(new))
        checks.append(('PLACES.md 머리말이 새 문구로 바뀜 (사용자가 고친 줄·데이터 줄은 그대로)', not left))
    if q['merge']:
        text = read(new)
        swap = dict(q['replace'])
        text = '\n'.join(swap.pop(l.rstrip(), l) for l in text.split('\n'))
        for sec, line in q['add']:
            lines = text.split('\n')
            head = next((i for i, l in enumerate(lines) if l.startswith('## ') and l[3:].strip() == sec), None)
            if head is None:
                text = text.rstrip('\n') + f'\n\n## {sec}\n\n{line}\n'
                continue
            end = next((i for i in range(head + 1, len(lines)) if lines[i].startswith('## ')), len(lines))
            body = [i for i in range(head + 1, end) if lines[i].startswith('- ')]
            if len(body) == 1 and lines[body[0]].strip() == '- 없음':
                lines[body[0]] = line
            elif body:
                lines.insert(body[-1] + 1, line)
            else:
                lines.insert(head + 1, '\n' + line)
            text = '\n'.join(lines)
        write(new, text)
        merged = {l for _, l in place_rows(read(new))}
        lost = [l for _, l in place_rows(read(old)) if l not in merged and l not in {n for _, n in q['keep']}]
        checks.append(('commander/PLACES.md 줄이 PLACES.md에 다 있음 (버린 줄 제외)', not lost))
        stray = place_stray(read(old))
        if stray:
            checks.append((f'commander/PLACES.md에 옮기지 못한 줄 없음 ({len(stray)}개 있어 옛 파일을 남김. '
                           '위 "옮기지 못함" 줄을 손으로 옮긴 뒤 옛 파일을 지운다)', False))
        if not lost and not stray:
            os.remove(old)
    for rel in q['refs']:
        path = os.path.join(wr, rel)
        write(path, read(path).replace('war-room/commander/PLACES.md', 'war-room/PLACES.md')
              .replace('commander/PLACES.md', 'war-room/PLACES.md'))
    return checks


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
    p['attempts_reset'] = (p['pv'] < ATTEMPTS_RESET_BEFORE
                           and pc.get('maxAttempts') == OLD_MAX_ATTEMPTS
                           and 'maxAttempts' in tc)
    p['attempts_new'] = tc.get('maxAttempts')

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
        p['roles'][role] = {'changed': parts[0].strip() != target.strip(), 'old': old,
                            'fm': dropped_frontmatter(parts[0], tparts[0], history, role == 'evaluator')}

    p['commander'] = {}
    if os.path.isdir(os.path.join(wr, 'commander')):
        for rel, name in COMMANDER_FILES:
            path = os.path.join(wr, rel)
            if not os.path.exists(path):
                p['commander'][rel] = None
                continue
            text = read(path)
            # MARK가 없으면 파일 끝에 빈 절이 있는 것으로 보고 전부를 템플릿 부분으로 다룬다
            upper = (split_role(text) or (text, ''))[0]
            tupper = split_role(read(os.path.join(COMMANDER_TEMPLATE, *rel.split(os.sep)[1:])))[0]
            current = {counted(l) for l in tupper.split('\n')} - {None}
            hist_path = os.path.join(HISTORY, f'{name}.txt')
            history = set(read(hist_path).split('\n')) if os.path.exists(hist_path) else set()
            old = 0
            body = re.sub(r'^---\n.*?\n---\n?', '', upper, count=1, flags=re.S)
            for line in body.split('\n'):
                sl = counted(line)
                if sl is None or sl in current:
                    continue
                if sl in history:
                    old += 1
                else:
                    p['moves'].append((rel, sl))
            # frontmatter의 model 값은 프로젝트 것을 지킨다 (evaluator와 같다)
            target = set_model(tupper, frontmatter_model(upper))
            p['commander'][rel] = {'changed': upper.strip() != target.strip(), 'old': old,
                                   'fm': dropped_frontmatter(upper, tupper, history, True)}

    st = read(os.path.join(wr, 'STATUS.md')) if os.path.exists(os.path.join(wr, 'STATUS.md')) else ''
    tst = read(os.path.join(TEMPLATE, 'STATUS.md'))
    p['status_header'] = bool(st) and header(st) != header(tst)
    ps = sections(st)
    ts = sections(tst)
    pkeys = {k: l for k, l in ps}
    p['status_add'] = [l for k, l in ts if k not in pkeys]
    p['status_retitle'] = [(pkeys[k], l) for k, l in ts if k in pkeys and pkeys[k] != l]

    root = os.path.dirname(os.path.abspath(wr))
    gi = os.path.join(root, '.gitignore')
    p['gitignore_add'] = not (os.path.exists(gi) and 'war-room/.eval/' in read(gi))
    p['root'] = root
    p['places'] = places_plan(wr)
    return p


def report(p):
    print(f"templateVersion: 프로젝트 {p['pv']} → 템플릿 {p['tv']}")
    for role, r in p['roles'].items():
        if r is None:
            print(f'roles/{role}.md: 없음 (바꾸지 않음)')
        else:
            n = sum(1 for m in p['moves'] if m[0] == role)
            state = '템플릿 부분 교체' if r['changed'] else '템플릿 부분 같음'
            print(f"roles/{role}.md: {state}, 옛 템플릿 문장 {r['old']}줄 버림, 사용자 문장 {n}줄 옮김{dropped_note(r['fm'])}")
    for rel, r in p['commander'].items():
        if r is None:
            print(f'{rel}: 없음, 건너뜀')
        else:
            n = sum(1 for m in p['moves'] if m[0] == rel)
            state = '템플릿 부분 교체' if r['changed'] else '템플릿 부분 같음'
            print(f"{rel}: {state}, 옛 템플릿 문장 {r['old']}줄 버림, 사용자 문장 {n}줄 옮김{dropped_note(r['fm'])}")
    print('config.json: ' + (('키 추가 ' + ', '.join(p['config_add'])) if p['config_add'] else '추가할 키 없음')
          + (', templateVersion 갱신' if p['pv'] != p['tv'] else ''))
    if p['attempts_reset']:
        print(f"config.json: maxAttempts {OLD_MAX_ATTEMPTS} → {p['attempts_new']} (옛 기본값 이전)")
    print(f"STATUS.md: 절 추가 {len(p['status_add'])}개, 절 제목 설명 갱신 {len(p['status_retitle'])}개"
          + (', 머리말 설명 갱신' if p['status_header'] else ''))
    print('.gitignore: ' + ('war-room/.eval/ 추가' if p['gitignore_add'] else '그대로'))
    places_report(p['places'])
    if p['moves']:
        print('옮길 사용자 문장 (--drop 번호로 뺄 수 있음):')
        for i, (role, s) in enumerate(p['moves'], 1):
            print(f'  {i}. ' + (role if role in p['commander'] else f'{role}.md') + f': {s}')


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

    for rel, r in p['commander'].items():
        if r is None:
            continue
        path = os.path.join(wr, rel)
        text = read(path)
        parts = split_role(text)
        proj = parts[1] if parts else MARK
        tupper, _ = split_role(read(os.path.join(COMMANDER_TEMPLATE, *rel.split(os.sep)[1:])))
        moved = [sl for rl, sl in keep if rl == rel]
        new_proj = proj.rstrip('\n')
        if moved:
            new_proj += '\n' + '\n'.join('- (템플릿 반영 때 옮김) ' + re.sub(r'^[-*]\s+', '', sl) for sl in moved)
        new_upper = set_model(tupper, frontmatter_model(text))
        write(path, new_upper + '\n' + new_proj + '\n')
        after = split_role(read(path))[1]
        checks.append((f'{rel} 프로젝트별 규칙 보존', after.startswith(proj.rstrip('\n'))))

    cfg_path = os.path.join(wr, 'config.json')
    cfg = json.loads(read(cfg_path))
    tc = json.loads(read(os.path.join(TEMPLATE, 'config.json')))
    merged = {}
    for k, v in tc.items():
        merged[k] = cfg[k] if k in cfg else v
    for k, v in cfg.items():
        if k not in merged:
            merged[k] = v
    if p['attempts_reset']:
        merged['maxAttempts'] = p['attempts_new']
    merged['templateVersion'] = tc['templateVersion']
    write(cfg_path, json.dumps(merged, ensure_ascii=False, indent=2) + '\n')
    after_cfg = json.loads(read(cfg_path))
    checks.append(('config.json 읽힘·roles 같음', after_cfg.get('roles') == before_cfg.get('roles')))

    st_path = os.path.join(wr, 'STATUS.md')
    if os.path.exists(st_path) and (p['status_add'] or p['status_retitle'] or p['status_header']):
        text = read(st_path)
        before_lines = len([l for l in text.split('\n') if l.strip() and not l.startswith('>')])
        if p['status_header']:
            head, rest = text.split('\n## ', 1) if '\n## ' in text else (text, None)
            kept = [l for l in head.split('\n') if not l.startswith('>')]
            new_head = header(read(os.path.join(TEMPLATE, 'STATUS.md')))
            out, placed = [], False
            for l in kept:
                out.append(l)
                if not placed and l.startswith('# '):
                    out += [''] + new_head
                    placed = True
            if not placed:
                out = new_head + out
            head = re.sub(r'\n{3,}', '\n\n', '\n'.join(out))
            text = head + ('\n## ' + rest if rest is not None else '')
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
        after_lines = len([l for l in read(st_path).split('\n') if l.strip() and not l.startswith('>')])
        checks.append(('STATUS.md 내용 줄 줄지 않음', after_lines >= before_lines))

    if p['gitignore_add']:
        gi = os.path.join(root, '.gitignore')
        old = read(gi) if os.path.exists(gi) else ''
        write(gi, old + ('' if old.endswith('\n') or not old else '\n') + 'war-room/.eval/\n')

    checks += places_apply(wr, p['places'])

    print(f"반영함: 템플릿 {p['pv']} → {p['tv']}, 사용자 문장 {len(keep)}줄 옮김, {len(p['moves']) - len(keep)}줄 버림")
    for name, ok in checks:
        print(('✓ ' if ok else '✗ ') + name)
    print(f'반영 전 사본: {backup}')
    return 0 if all(ok for _, ok in checks) else 3


def places_only(wr):
    """버전과 상관없이 장소 목록만 옮긴다 (감독 지정·이어받기 때)."""
    if not os.path.isdir(wr):
        print(f'멈춤: {wr} 폴더가 없음')
        return 3
    q = places_plan(wr)
    places_report(q)
    if not (q['create'] or q['merge'] or q['refs'] or q['head']):
        return 1
    backup = tempfile.mkdtemp(prefix='war-room-places-')
    for rel in (PLACES, OLD_PLACES) + PLACES_REFS:
        src = os.path.join(wr, rel)
        if os.path.exists(src):
            os.makedirs(os.path.dirname(os.path.join(backup, rel)), exist_ok=True)
            shutil.copyfile(src, os.path.join(backup, rel))
    checks = places_apply(wr, q)
    for name, ok in checks:
        print(('✓ ' if ok else '✗ ') + name)
    print(f'반영 전 사본: {backup}')
    return 0 if all(ok for _, ok in checks) else 3


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in ('check', 'apply', 'places'):
        print(__doc__)
        return 3
    wr = os.path.abspath(sys.argv[2])
    if sys.argv[1] == 'places':
        return places_only(wr)
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
