# 설치 · 롤 관리

SKILL.md "모드"에서 설치·롤 관리일 때 읽는다. 배정 때는 읽지 않는다.

## war-room-guard mod

war-room이 켜진 프로젝트에서는 armory의 `war-room-guard` mod가 이 지침("먼저 담당 롤을 찾고 배정 한 줄을 알린다")을 요청마다 시스템 프롬프트 끝의 `# war-room` 절에 넣는다. 답만 하면 되는 질문과, 롤·검증·조사·설계 등 서브에이전트로 실행 중일 때는 따르지 않는다.
- mod는 세션 작업 폴더에서 위로 올라가며 처음 만나는 `war-room/config.json`을 쓴다. 하위 폴더에 자체 war-room이 있으면 그쪽이 먼저 잡힌다.
- `enabled: false`나 `roles.manager: false`면 지침이 빠진다. JSON이 깨졌으면 지침은 들어가고, 스킬이 SKILL.md config 규칙대로 오류를 알린다.
- 지침은 세션에서 스킬을 한 번 불렀으면 다시 부르지 않게 한다. 대화가 압축돼 스킬 내용이 보이지 않을 때만 다시 부른다.

## 설치

1. 프로젝트 루트를 확인한다 (`git rev-parse --show-toplevel`, 없으면 현재 폴더).
2. 이 스킬의 `template/`을 `<루트>/war-room/`으로 복사한다. 이미 있는 파일은 덮어쓰지 않는다.
   - `config.json`, `roles/manager.md`, `roles/evaluator.md`, `STATUS.md`, `DECISIONS.md`, `LESSONS.md`, `archive/.gitkeep`
   - 프로젝트 `.gitignore`에 `war-room/.eval/`가 없으면 한 줄 추가한다 (평가 진행 파일은 커밋하지 않는다).
3. 프로젝트 규모(반복되는 일의 종류, 영역 수)에 맞춰 필요한 만큼 롤 후보를 제안한다. 개수 제한은 없다. 겹치는 후보는 합치거나 뺀다 (`references/role-discovery.md`).
   - 이 프로젝트의 이전 세션·메모리·CLAUDE.md·git 이력이 있으면 수집 sonnet → 제안 opus 서브에이전트 순서로 읽기 전용으로 반복된 일의 사실을 모아 후보를 만든다. 메인 세션은 jsonl을 직접 읽지 않는다.
   - 중복 배제: 맡는 일이나 담당 경로가 겹치는 후보는 하나로 합친다. 합칠 수 없으면 `하지 않는 일`로 경계를 적는다. 경계를 적은 뒤에도 두 후보의 scope에 같은 경로가 남으면 근거가 약한 쪽(근거 출처 종류 수, 같으면 횟수가 적은 쪽)을 뺀다. `war-room/roles/`에 이미 있는 롤과 겹치는 후보도 뺀다.
   - 롤마다 이름, 맡을 일 한 줄, 담당 경로, 근거(출처와 횟수)를 보여준다. 원문·비밀값은 옮기지 않는다.
   - 이전 기록이 없으면 "이전 기록 없음, 구조만 보고 제안"이라 밝히고 수집은 건너뛴 채 opus가 폴더 구조·빌드 설정·README만 본다.
4. 사용자가 고른 롤만 만든다. 고르지 않으면 기본 롤(`manager`, `evaluator`)만 둔다.
5. `roles/manager.md`의 "프로젝트별 규칙"에 넣을 것(테스트 명령, 커밋 규칙)이 있는지 묻는다. 수치 측정 명령은 `roles/evaluator.md`에 적는다.

`war-room/`은 커밋해서 팀과 같이 쓰는 것을 기본으로 한다.

## 롤 관리

- **추가**
  - `references/role-template.md` 형식으로 `roles/<id>.md`를 만들고 config `roles`에 `"<id>": true`를 넣는다.
  - 사용자가 말한 것과 코드에서 확인한 것만 적는다. 명령·경로는 실제로 있는지 확인한다.
  - 기존 롤과 맡는 일이 겹치면 양쪽 `하지 않는 일`에 경계를 적는다.
- **끄기·켜기**: config 값만 바꾼다. 롤 파일은 그대로 둔다.
- **삭제**: 사용자가 삭제라고 말할 때만 파일을 지우고 config에서 뺀다. DECISIONS·archive의 지난 항목은 그대로 둔다.
- **`manager` 롤**은 지우지 않는다. 내용(프로젝트별 규칙)은 고칠 수 있다. **`evaluator` 롤**은 끄거나 지울 수 있다.

