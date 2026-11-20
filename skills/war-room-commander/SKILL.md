---
name: war-room-commander
description: Use when the user wants to designate, hand over, release or check the supervisor (commander) seat of a war-room project — the seat that directs several work sessions, hands its own work to supervisor-only sub-roles (po, pm, tpm) and keeps its own board (war-room/COMMAND.md) so a restarted session can pick up where the last one left off. Triggers include "감독 지정", "이 세션을 감독으로", "감독 이어받기", "감독 넘겨", "감독 해제", "감독 내려놔", "지금 감독 있어?", "누가 감독이야", "지휘 보드", and the same with the other names for the seat ("커맨더", "총지휘자", "지휘자", "총매니저"). Also use when a restarted or compacted session finds war-room/COMMAND.md with an occupied seat and must tell whether it is the holder. Not for the plain "매니저" role, and not for running `[감독 지시]`/`[작업 보고]` once the seat is settled — that is the war-room skill's references/multi-session.md.
---

# War Room Commander (감독 지정)

war-room 프로젝트에 **감독(commander) 자리**를 만들고, 그 자리를 맡을 세션을 정한다. 감독은 작업 세션 매니저들 윗급이다. 여러 작업 세션에 지시하고, 사용자 결정을 받아 전한다. 감독 세션은 배분·사용자 대화·위임만 하고, 분석·기록·검토는 감독 전용 롤 po·pm·tpm(`war-room/commander/roles/`)에 맡긴다. 감독 세션에는 매니저가 없다. 감독 자리는 기본으로 없고, 지정하면 생기고, 해제하면 비워진다.

부르는 이름은 모두 같은 자리다: 감독, 커맨더, 총지휘자, 지휘자, 총매니저. 그냥 "매니저"는 기존 manager 롤이다.

> **감독은 세션이 아니라 자리에 지정한다.** 세션은 다시 시작하면 바뀐다. 그래서 자리와 상태를 `war-room/COMMAND.md`(지휘 보드)에 두고, 새 세션은 보드를 읽고 자리를 이어받는다.

이 스킬은 자리를 정하고, 감독 파일을 설치하고, 보드 규칙을 정하는 일만 한다. 지시·보고·교차 판정·머지 관문의 운영 규칙은 `war-room` 스킬 `references/multi-session.md`에 있고, 여기에 옮겨 적지 않는다.

## 0. 전제 확인 (모든 요청에서 먼저)

1. 프로젝트 루트에 `war-room/`과 `war-room/config.json`이 있는지 본다. 없으면 멈추고 "감독 자리는 war-room 프로젝트에만 둔다"고 알린 뒤, war-room 설치(`war-room` 스킬 `references/setup.md`)를 할지 묻는다. 묻기만 하고 설치하지 않는다.
2. `config.json`의 `enabled`가 `false`면 멈추고 알린다.
3. 서브에이전트로 실행 중이면 이 스킬을 따르지 않는다. 감독은 메인 세션만 맡는다.
4. 연결 워크트리에서 도는 세션(`git rev-parse --git-dir`와 `git rev-parse --git-common-dir`가 다름)은 감독이 되지 않는다. 작업 세션 자리다. 본 체크아웃에서 감독 세션을 열라고 알린다.

## 1. 자리 상태 읽기 ("지금 감독 있어?")

- `config.json`의 `roles.commander`와 `war-room/COMMAND.md`의 `## 감독 자리` 절을 읽는다.
- 답은 셋 중 하나다. 판단 기준은 보드의 `상태:` 줄이고, config와 다르면 아래 "어긋남"을 따른다.

| 보드 `상태:` | 답 |
|---|---|
| 파일 없음 또는 `비어 있음` | "감독이 없다." 마지막 자리 이력이 있으면 한 줄 덧붙인다 |
| `맡음` | 담당 표시·위치·맡은 시각·보드 `갱신:` 시각을 알린다 |
| `이어받기 대기` | 누구에게 넘기려 했는지와 넘긴 시각을 알린다 |

- 어긋남: `roles.commander`가 `true`인데 보드가 없거나 `비어 있음`이면, 또는 `false`(없음 포함)인데 보드가 `맡음`이면 고치지 않고 둘 다 보여준 뒤 어느 쪽이 맞는지 묻는다. 추측해서 고치지 않는다.
- 이 질문에는 상태만 답한다. 파일을 고치지 않는다.

## 2. 지정 ("이 세션을 감독으로", "세션 B를 감독으로")

1. 1절로 지금 상태를 읽는다. `맡음`이면 새로 지정하지 않고 3절(이어받기)로 간다.
2. **담당 표시**를 정한다. 사용자가 이름을 주면 그 이름, 없으면 `감독-<YYYYMMDD-HHMM>`(`date '+%Y%m%d-%H%M'`). 세션 ID 대신 이 표시로 담당을 가린다.
3. 감독 파일을 설치하고 보드를 맞춘다 (아래 "감독 파일 설치", "보드 맞추기"). 이어받기 때도 같은 단계를 한다.
4. `config.json`의 `roles`에 `"commander": true`를 넣는다. 다른 키는 건드리지 않는다.
5. 보드 `## 감독 자리`를 채운다.
   - 이 세션을 지정하면 `상태: 맡음`, 담당 표시, 위치(`pwd` · `git branch --show-current`), 맡은 시각.
   - 다른 세션을 지정하면 `상태: 이어받기 대기`와 넘길 담당 표시만 적는다. 그 세션에서 "감독 이어받기 <표시>"를 하라고 사용자에게 알린다. 이 세션은 감독이 되지 않는다.
6. 위임받은 권한을 정한다. 사용자가 포괄 권한("알아서", "전권")을 줬으면 `multi-session.md` 6절대로 항목으로 풀어 확인받고, pm에 맡겨 `war-room/commander/DECISIONS.md`에 적게 한 뒤 `## 감독 자리`에는 그 결정 제목만 건다. 말이 없으면 `위임 안 됨: 전부 (확인함)`으로 둔다.
7. `## 자리 이력` 맨 위에 `<시각> · 지정 · <담당 표시> · <지정한 세션 또는 사용자>`를 한 줄 쓴다.
8. `STATUS.md` `## 진행 중`에 세션별 줄이 있으면 (예전 `multi-session.md` 형식: `세션 · 맡은 범위 · 위치 · …`로 롤 줄과 다르다) pm에 맡겨 보드 `## 작업 세션`으로 옮긴다. 예외: STATUS에서 그 줄을 지우는 일은 이 지정 단계에서 지정 요청을 받은 세션이 한 번 직접 한다. 감독 쪽이 STATUS를 쓰는 유일한 경우다 (`multi-session.md` 3절). 롤 줄은 건드리지 않는다. 같은 내용을 두 곳에 두지 않는다.
9. 알린다: `감독 지정: <담당 표시> (<위치>). 보드: war-room/COMMAND.md`

### 감독 파일 설치 (지정·이어받기 때)

없는 파일만 이 스킬의 `template/`에서 복사한다. 있으면 그대로 둔다 (프로젝트별 규칙을 지키기 위해). 플러그인을 업데이트해도 `upgrade.py`는 이 파일들을 고치지 않는다. 새 템플릿 파일은 다음 지정·이어받기 때 이 단계로 들어가고, 이미 있던 보드의 형식 차이는 이어서 "보드 맞추기"로 맞춘다.

| 템플릿 | 설치 위치 |
|---|---|
| `template/COMMAND.md` | `war-room/COMMAND.md` |
| `template/commander/commander.md` | `war-room/commander/commander.md` |
| `template/commander/DECISIONS.md` | `war-room/commander/DECISIONS.md` (감독 결정) |
| `template/commander/LESSONS.md` | `war-room/commander/LESSONS.md` (감독 교훈) |
| `template/commander/PLACES.md` | `war-room/commander/PLACES.md` (감독 장소 목록) |
| `template/commander/roles/po.md`·`pm.md`·`tpm.md` | `war-room/commander/roles/` 같은 이름 |

- 예전 위치 이동: `war-room/roles/commander.md`가 있고 `war-room/commander/commander.md`가 없으면, 템플릿을 복사하지 않고 `mkdir -p war-room/commander && git mv war-room/roles/commander.md war-room/commander/commander.md`로 내용 그대로 옮긴다 (git이 추적하지 않는 파일이면 `mv`). 둘 다 있으면 옮기지 않고 둘 다 있다고 알린다. 옮겼으면 알림에 `예전 roles/commander.md를 commander/commander.md로 옮김`을 붙인다.
- `war-room/commander/`는 매니저 배정 대상이 아니다. 매니저는 `war-room/roles/`만 본다.

### 보드 맞추기 (지정·이어받기 때, 설치 다음)

예전 판에서 설치한 `war-room/COMMAND.md`는 설치 단계가 고치지 않는다. 요청을 받은 세션이 pm에 맡겨 템플릿 형식으로 맞춘다. 프롬프트에 이 스킬의 `template/COMMAND.md` 경로를 준다. pm은 바뀐 곳만 Edit로 고친다.

- 건너뛴다: 보드를 이 설치 단계에서 막 복사했거나, 아래 넷 다 해당이 없으면 (머리말·절 제목이 템플릿과 같고, 빠진 절이 없고, 기준선 칸 없는 지시 줄이 없고, 예전 결정·교훈 절이 없음).
1. 머리말(`>` 줄)과 절 제목 줄이 템플릿과 다르면 템플릿 줄로 바꾼다. 템플릿에 있는데 보드에 없는 절(예: `## 점검할 결정`)은 템플릿 순서 자리에 템플릿 내용 그대로 넣는다. `## 감독 자리`·`## 자리 이력`이 없을 때도 템플릿 그대로만 넣고, 채우는 일은 요청을 받은 세션이 한다.
2. `## 지시`의 기존 줄에 기준선 칸이 없으면 요약 칸 뒤에 `–`를 넣는다.
3. 예전 보드의 감독 결정·교훈 절(`## 결정`·`## 교훈`)에 `없음` 말고 내용이 있으면, 결정은 `war-room/commander/DECISIONS.md`, 교훈은 `war-room/commander/LESSONS.md` 맨 위로 그 파일 형식에 맞춰 옮긴 뒤 두 절을 지운다. 내용이 없으면 절만 지운다.
4. 감독 결정이 이미 작업 세션 쪽 `war-room/DECISIONS.md`에 적혀 있으면 (판단: 예전 머리말이 결정 원문을 `commander/` 없는 `DECISIONS.md`로 가리킴, 또는 그 파일에 `정한 사람: 감독`이나 결정 ID 항목이 있음) 옮기지 않고 그대로 둔다. 그 파일은 작업 세션 매니저 몫이라 감독 쪽은 쓰지 않는다. 대신 `war-room/commander/DECISIONS.md` 맨 위에 안내 항목 하나만 둔다: `## <오늘> · – · 이전 감독 결정 위치` / `- 결정: 이전 감독 결정은 war-room/DECISIONS.md <그 파일의 마지막 감독 결정 날짜>까지`. 같은 안내 항목이 이미 있으면 더하지 않는다.
- pm은 `보드 맞추기: 건너뜀 | 바꾼 절 <…> · 옮긴 결정 n개·교훈 n개 · 안내 항목 추가 여부`로 답한다. 요청을 받은 세션은 이 줄을 지정·이어받기 알림에 붙인다.

## 3. 이어받기 ("감독 이어받기", 재시작한 세션)

보드가 `맡음` 또는 `이어받기 대기`일 때 다른 세션이 자리를 맡는 절차다.

1. 이전 담당이 끝났는지 확인한다. 세션이 살아 있는지는 파일로 알 수 없다. 기준은 아래 순서다.
   - 사용자가 요청에서 "이전 세션 끝났다", "재시작했다"처럼 말했거나, 상태가 `이어받기 대기`이고 표시가 맞으면 바로 넘어간다.
   - 아니면 이전 담당 표시·위치·보드 `갱신:` 시각을 보여주고 "그 세션을 닫았나요?"를 한 번 묻는다. 답이 없으면 이어받지 않는다. 두 세션이 함께 감독이 되면 지시와 기록이 갈린다.
2. 감독 파일을 설치하고 보드를 맞춘다 (2절 "감독 파일 설치", "보드 맞추기"). 보드 `## 감독 자리`를 새 담당으로 고친다 (`상태: 맡음`, 새 표시·위치·시각). 위임받은 권한은 그대로 둔다. 권한은 사람에게 받은 것이라 세션이 바뀌어도 이어진다.
3. `## 자리 이력` 맨 위에 `<시각> · 이어받기 · <이전 표시> → <새 표시>`를 쓴다.
4. tpm에 이어받기 요약을 맡긴다. tpm이 보드의 `## 다시 시작하면 할 일`, `## 지시`, `## 대기 중인 교차 판정`, `## 점검할 결정`, `## 사람 확인 대기`와 `war-room/commander/DECISIONS.md` 맨 위 5개 항목을 세 줄 안으로 요약하고, 작업 세션 워크트리의 HEAD가 보드의 `마지막 보고 커밋`과 다른 세션을 짚는다 (`multi-session.md` 5절의 기계 확인). 감독은 그 요약을 알리고, 짚힌 세션에 보고를 다시 받는다.

**재시작·압축 뒤 자기 확인**: war-room 스킬을 부를 때 보드가 `맡음`이면, 이 세션이 담당인지 대화에 남은 담당 표시로 확인한다. 표시가 대화에 없어 알 수 없으면 짐작하지 않고 "이 세션이 감독 <표시>를 이어받을까요?"를 묻는다. 답을 받기 전에는 평소 매니저로만 일하고 보드를 쓰지 않는다.

## 4. 해제 ("감독 해제", "감독 내려놔")

1. 남은 일을 확인해 보여준다: tpm에 맡겨 보드의 보낸 뒤 보고가 안 온 지시, 대기 중인 교차 판정, 사람 확인 대기를 센다. 하나라도 있으면 "남은 채로 해제할지"를 묻는다. 해제는 작업 세션을 멈추지 않는다.
2. 보드 `## 감독 자리`를 `상태: 비어 있음`으로 고치고 담당 줄을 지운다. 위임받은 권한 줄도 `없음`으로 바꾼다. 위임은 그 감독 자리에 준 것이라 다음 지정 때 다시 받는다.
3. `config.json`의 `roles.commander`를 `false`로 바꾼다. `war-room/commander/`와 보드 파일은 지우지 않는다 (프로젝트별 규칙과 이력 보존).
4. `## 자리 이력` 맨 위에 `<시각> · 해제 · <표시> · 남은 일 n개`를 쓴다.
5. 알린다: `감독 해제. 이 세션은 매니저로 돌아갑니다.`

## 5. 감독으로 일할 때

- **문서**: 담당 세션은 `war-room/roles/manager.md` 대신 `war-room/commander/commander.md`를 따른다. 부딪히면 `commander/commander.md` 프로젝트별 규칙 → 이 스킬 → `multi-session.md` 순이다.
- **직접 하는 것**: 배분 결정, 사용자 대화(po가 못 찾은 위치 묻기 포함), 감독 롤에 맡기기, 찾은 실제 위치를 `[감독 지시]`·위임 프롬프트에 넣기, 시작할 때 보드 `## 감독 자리` 절만 읽어 담당 확인, 지정·이어받기·해제 때 `## 감독 자리`·`## 자리 이력` 기록. 이것뿐이다.
- **직접 하지 않는 것**: 구현·조사(하 등급 포함), 보드 갱신, git 확인. 각각 작업 세션·po·pm·tpm에 맡긴다. `war-room/roles/`의 롤(manager 포함)은 감독 세션에서 쓰지 않는다 (`multi-session.md` 2절).
- **감독 롤**: `war-room/commander/roles/`의 po(요구 분석, 위치 찾기)·pm(보드·장소 목록 기록)·tpm(진행 검토, 로컬 경로 확인). 맡기는 때와 흐름은 `commander/commander.md`. 교차 판정은 `armory:evaluator`(`multi-session.md` 5절).
- **위치가 빠진 요청** ("그 파일 옮겨", "그 깃 이슈 가져와", "지라 업데이트해"): po가 요청 속 표현으로 `war-room/commander/PLACES.md`를 grep해 실제 경로·키로 바꾼다. 못 찾거나 여러 개면 감독이 사용자에게 묻는다. 감독은 찾은 위치를 지시·위임 프롬프트에 그대로 넣고, 작업 세션과 작업을 맡은 하위 에이전트에게 이 파일을 읽게 하지 않는다 (읽는 것은 감독 롤뿐, 6절 표).
- **운영**: 지시·보고·교차 판정·승인·머지 관문은 `war-room` 스킬 `references/multi-session.md`를 따른다. 세션에서 한 번 읽었으면 다시 읽지 않는다.
- **보드 갱신 때**: 감독은 아래 일이 있을 때마다 pm에 맡긴다. pm은 그 절만 Edit로 고치고 맨 위 `갱신:` 시각을 바꾼다. 통째로 다시 쓰지 않는다.
  - 지시를 보냄 → `## 지시`에 줄 추가(기준선 칸은 지시 `## 기준선`의 커밋 해시, 칸이 없으면 `–`), `## 작업 세션`의 마지막 지시 ID. pm에 지시 원문을 준다
  - 보고가 옴 → `## 지시` 상태와 출처, `## 작업 세션`의 마지막 보고 커밋·상태
  - 새 세션이 생김 → `## 작업 세션`에 줄 추가
  - 교차 판정을 띄우거나 끝냄 → `## 대기 중인 교차 판정`
  - 감독·사용자 결정이 나옴 → `war-room/commander/DECISIONS.md` 맨 위에 원문, 점검이 남은 감독 결정은 보드 `## 점검할 결정`에 결정 ID, 사람이 정해야 하면 `## 사람 확인 대기`에 제목
  - 감독 쪽 교훈이 생김 (감독·감독 롤의 판단 실수·막힌 일, 같은 이유의 두 번째 보완 지시, 연결 워크트리 보고의 `겪은 문제` 중 남길 것) → `war-room/commander/LESSONS.md` 맨 위에 항목
  - 사용자가 위치를 확인함 (po가 못 찾은 표현의 답, 또는 tpm·작업 보고로 드러난 낡은 위치의 새 값·지움) → `사용자 확인: <부르는 말> → <위치> · <종류> · <쓰는 때>`를 프롬프트에 넣어 맡긴다. pm이 `war-room/commander/PLACES.md`의 맞는 절에 한 줄을 넣거나 고친다. 사용자가 확인하지 않은 값은 맡기지 않는다
  - 사용자가 감독 교훈 반영을 승인함 → 승인 줄(`사용자 승인: <교훈 날짜 · 요약> → <파일> <절>에 <넣을 문장>`)을 프롬프트에 넣어 맡긴다. pm이 `war-room/commander/commander.md` `# 프로젝트별 규칙` 절 또는 `war-room/commander/roles/<id>.md`(`pm.md` 포함)에 넣고 그 교훈을 archive로 옮긴다
  - 턴을 마칠 때 → `## 다시 시작하면 할 일`을 1~3줄로 맞춘다. 이 세션이 지금 끝나도 새 세션이 이 절과 보드만 읽고 이어갈 수 있어야 한다
- **이어받기 점검**: pm이 보드를 고친 뒤 "새 세션이 보드만 읽고 지금 상태·다음 할 일·기다리는 것을 말할 수 있나"를 본다. 못 하면 빠진 것을 보드에 더한다.

## 6. 보드 쓰는 규칙

- 보드와 `war-room/commander/DECISIONS.md`·`LESSONS.md`·`PLACES.md`는 감독 롤 pm만 쓴다. `PLACES.md`에는 사용자가 확인한 위치만 적고, 비밀(토큰·비밀번호·인증 정보)은 적지 않는다. 감독 세션 자신과 다른 세션은 쓰지 않는다. 예외: 2·3·4절의 지정·이어받기·해제 때 `## 감독 자리`·`## 자리 이력`은 그 요청을 받은 세션이 쓴다.
- `war-room/commander/commander.md`의 `# 프로젝트별 규칙` 절과 `war-room/commander/roles/*.md`는 감독 쪽에서 사용자가 승인한 교훈 반영으로만 고치고, 그것도 pm이 쓴다. 감독은 승인 줄을 위임 프롬프트에 넣어 넘긴다 (5절). 승인 줄이 없으면 pm은 쓰지 않는다. 쓰기 권한이 있는 감독 롤은 pm 하나다.
- 감독 쪽은 작업 세션 매니저의 `war-room/STATUS.md`·`war-room/DECISIONS.md`·`war-room/LESSONS.md`를 쓰지 않는다. 감독 쪽 결정·교훈은 이름이 같아도 항상 `war-room/commander/` 아래 파일이다. 예외: 2절 8단계에서 STATUS의 예전 형식 세션 줄을 한 번 지운다.
- 읽는 범위 (작업 세션은 쓰지 않는다)

| 누가 | `COMMAND.md` | `commander/DECISIONS.md` | `commander/LESSONS.md` | `commander/PLACES.md` |
|---|---|---|---|---|
| 감독 | `## 감독 자리`만 | 읽지 않는다 (결론은 롤에게 받는다) | 읽지 않는다 | 읽지 않는다 (찾은 위치는 po에게 받는다) |
| po | `## 작업 세션`, `## 지시`의 진행 중인 줄 | 요청의 세션 이름·대상 경로·키워드로 grep해 걸린 항목만 | 같은 방식으로 grep해 걸린 항목만 (지시에 넣을 교훈) | 요청 속 위치 표현으로 grep해 걸린 줄만. 그런 표현이 없으면 읽지 않는다 |
| pm | 전부 | 맨 위 항목에 더할 때 앞부분만, 뒤집을 때 그 항목을 grep | 전부 (정리 주기 판단) | 고칠 때만 (넣을 절과 부르는 말로 grep해 걸린 줄) |
| tpm | 전부 | 이어받기 요약 때 맨 위 5개 항목만. 그 밖에는 읽지 않는다 | 읽지 않는다 | 위치 확인을 맡았을 때 그 경로 줄만 |

- 원본 경계 (같은 내용을 두 곳에 두지 않는다)

| 무엇 | 원본 |
|---|---|
| 감독 자리·위임 범위 요약·세션별 줄·지시 진행·교차 판정·점검할 결정 ID·머지 관문 | `COMMAND.md` |
| 감독 쪽 결정 원문 (사용자·감독 결정, 위임받은 권한, 결정 ID) | `war-room/commander/DECISIONS.md` (pm). 점검이 남은 결정 ID만 보드 `## 점검할 결정` |
| 감독 쪽 교훈 (감독·감독 롤의 시행착오, 연결 워크트리 보고의 `겪은 문제` 중 남길 것) | `war-room/commander/LESSONS.md` (pm). `war-room/LESSONS.md`가 아니다 |
| 반복해 쓰는 위치 (파일·폴더, 깃 저장소·이슈, 지라 사이트·키·보드, 문서 URL, 자주 쓰는 명령) | `war-room/commander/PLACES.md` (pm). 지시에는 찾은 위치 값만 넣는다 |
| 작업 세션 안의 롤 작업과 그 결정·교훈 (작업 세션 매니저 몫) | `war-room/STATUS.md`·`war-room/DECISIONS.md`·`war-room/LESSONS.md` |
| 할 일·완료 조건 | 이슈 트래커 |

- 화면으로 보고 싶다고 하면 `status-dashboard` 스킬로 진행판을 만들 수 있다. 그때는 `## 작업 세션`·`## 지시`를 진행판 JSON으로 옮기고 보드에는 진행판 경로만 둔다. 둘 다 원본으로 두지 않는다.
- 보고 원문을 옮기지 않는다. 지시 한 줄, 보고 한 줄로 요약한다.
- 크기 (pm이 한다): 고친 뒤 `wc -c war-room/COMMAND.md`가 20KB(20,480바이트)를 넘으면 `## 지시`에서 `통과`한 줄을 오래된 것부터 `war-room/archive/COMMAND-YYYY-MM.md`(줄 날짜의 달, 없으면 `# 지난 지시 (YYYY-MM)` 제목으로 만든다)로 옮긴다. 다 옮겨도 넘으면 더 자르지 않고 사용자에게 알린다. `## 자리 이력`은 옮기지 않는다.
- `commander/DECISIONS.md`·`commander/LESSONS.md` 크기 (pm이 한다): `war-room` 스킬 `references/state-docs.md` 2·3절과 같은 방식이다. DECISIONS는 300줄을 넘으면 지난달 이전 항목을, LESSONS는 반영했거나 더는 맞지 않는 항목을 `war-room/commander/archive/DECISIONS-YYYY.md`·`LESSONS-YYYY.md`(해당 연도)로 옮긴다. LESSONS 반영·정리 제안 주기(같은 교훈 두 번째, 5개 초과 또는 14일)도 같다. 반영은 감독이 사용자에게 보여주고 승인받은 것만, 승인 줄을 받은 pm이 한다 (위 항목).
- 비밀값·토큰·개인정보는 적지 않는다.

## 하지 않는 것

- 서브에이전트나 연결 워크트리 세션을 감독으로 지정하기
- 이전 담당이 끝났는지 확인하지 않고 자리 이어받기
- 감독 자리에 사용자 대신 되돌리기 어려운 결정 권한 주기 (`multi-session.md` 6절)
- 해제하면서 작업 세션을 멈추거나 보드·`commander/` 파일 지우기
- 보드에 보고 원문을 옮겨 적기
- 감독 세션이 구현·조사·보드 갱신·git 확인을 직접 하거나 `war-room/roles/`의 롤에 맡기기
- 새 세션을 감독이 직접 띄우기 (사용자에게 명령을 안내한다. `commander/commander.md`)
