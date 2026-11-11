"""Write the API's contract to openapi.yaml, so it is reviewed in a PR like any other change.

FastAPI builds the spec from the routes and Pydantic models (it is also served live at
/openapi.json and /docs). This freezes that into a committed file. Re-run it whenever a route
or model changes; tests/test_openapi.py fails in CI when the committed file is out of date.
The examples in it come from app/openapi_examples.json; to refresh them, see tests/record_examples.py.

Run from apps/api (the .venv must be active, or call .venv\\Scripts\\python.exe):

    python scripts/export_openapi.py            # rewrite openapi.yaml
    python scripts/export_openapi.py --check    # exit 1 if openapi.yaml is out of date
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

# make `app` importable no matter where the script is launched from
API_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_DIR))

from app.main import app

SPEC_PATH = API_DIR / "openapi.yaml"


def render() -> str:
    # sort_keys=False keeps FastAPI's order (paths as mounted), which makes the diff readable
    return yaml.safe_dump(app.openapi(), sort_keys=False, allow_unicode=True, width=100)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="compare only; do not write")
    args = parser.parse_args()

    spec = render()
    if args.check:
        current = SPEC_PATH.read_text(encoding="utf-8") if SPEC_PATH.exists() else ""
        if current != spec:
            print(f"{SPEC_PATH.name} is out of date: run python scripts/export_openapi.py")
            return 1
        print(f"{SPEC_PATH.name} is up to date")
        return 0
    SPEC_PATH.write_text(spec, encoding="utf-8", newline="\n")
    print(f"wrote {SPEC_PATH} ({len(app.openapi()['paths'])} paths)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
