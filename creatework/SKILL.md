---
description: "Create a new workspace directory and open it in VSCode. Usage: /creatework [project-name]"
---

# CreateWork

> 새 워크스페이스 디렉토리를 생성하고 VSCode로 연다.

## Flow

1. **프로젝트 이름 추출**: 인자에서 프로젝트 이름을 가져온다. 없으면 `AskUserQuestion`으로 물어본다.
2. **이름 정규화**: 공백 → 하이픈, 특수문자 제거, 소문자 변환. 예: `My Project` → `my-project`
3. **디렉토리 생성**: `~/[project-name]` 경로에 디렉토리를 생성한다.
4. **VSCode 실행**: `code ~/[project-name]` 으로 VSCode를 연다.
5. **결과 보고**: 생성된 경로와 VSCode 실행 결과를 사용자에게 알린다.

## Rules

- 경로는 항상 사용자 홈 디렉토리(`~/`) 아래에 생성한다.
- 디렉토리가 이미 존재하면 `AskUserQuestion`으로 확인한다: "덮어쓰기" / "다른 이름 입력" / "취소"
- 이름에 허용되는 문자: `a-z`, `0-9`, `-`, `_`
- 빈 이름이나 `.`/`..`은 거부한다.
- `code` 명령이 실패하면 경로만 알려주고 수동 실행 안내한다.
