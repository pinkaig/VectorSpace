"""Builds the Postman collection and its environments. Edit this file, not the JSON.

Run from VectorSpace/ (no packages needed beyond the standard library):

    apps/api/.venv/Scripts/python apps/api/postman/build_collection.py

Writes, next to this file:
    vectorspace.postman_collection.json   the requests, their tests, and saved example responses
    local.postman_environment.json        a uvicorn on this machine, seeded with app.seed, dev logins
    ci.postman_environment.json           the same against the CI job's uvicorn (Phase 5)
    deployed.postman_environment.json     the Render API; token values left empty on purpose

Why a generator: 60-odd requests share the same three checks (status, time budget, JSON shape);
written by hand they drift. The saved examples come from app/openapi_examples.json, the same
recorded exchanges the OpenAPI spec carries, so a Postman mock server answers what the real API
answers.

Tokens are never written here. Locally and in CI the API runs with AUTH_DEV_BYPASS, so the token is
the literal "dev|<seed login>". Against the deployed API, pass real Auth0 access tokens on the
command line (newman --env-var token_admin=...) or as Postman "current values", which Postman keeps
on your machine and does not export or sync.
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
EXAMPLES = json.loads((HERE.parent / "app" / "openapi_examples.json").read_text(encoding="utf-8"))
API = "/api/v1"

# ── JSON shapes (JSON Schema, checked with pm.response.to.have.jsonSchema) ──

UUID = {"type": "string", "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"}
STR = {"type": "string"}
INT = {"type": "integer"}
BOOL = {"type": "boolean"}


def nullable(schema: dict) -> dict:
    return {"anyOf": [schema, {"type": "null"}]}


def obj(**props: dict) -> dict:
    """An object that must carry every listed key (extra keys are fine: adding a field stays v1)."""
    return {"type": "object", "required": list(props), "properties": props}


def array(items: dict) -> dict:
    return {"type": "array", "items": items}


ERROR = obj(detail={"anyOf": [STR, {"type": "array"}, {"type": "object"}]})
VALIDATION_ERROR = obj(detail=array(obj(loc={"type": "array"}, msg=STR, type=STR)))
HEALTH = obj(status={"const": "ok"}, service=STR)
ME = obj(id=UUID, organisation_id=UUID, display_name=STR, role={"enum": ["admin", "teacher", "student"]},
         class_ids=array(UUID))
CLASS = obj(id=UUID, school_id=UUID, name=STR, member_count=INT)
MEMBER = obj(id=UUID, display_name=STR, role=STR)
MOVE = obj(student=MEMBER, from_class=CLASS, to_class=CLASS)
PROJECT = obj(id=UUID, organisation_id=UUID, created_by_id=UUID, class_id=nullable(UUID), kind={"enum": ["project", "template"]},
              name=STR, slug=STR, status={"enum": ["draft", "published", "archived"]}, current_version_id=nullable(UUID),
              current_revision=INT, created_at=STR, updated_at=STR, created_by_name=STR, assignment_id=nullable(UUID),
              showcase=BOOL, review_status=nullable(STR))
VERSION = obj(id=UUID, project_id=UUID, revision=INT, label=nullable(STR), content_snapshot_id=UUID, created_at=STR)
VERSION_DETAIL = {**VERSION, "required": VERSION["required"] + ["data"]}
MEDIA = obj(id=UUID, project_id=UUID, kind=STR, source={"enum": ["file", "external"]}, label=STR,
            status=nullable(STR), approval=nullable(STR), created_at=STR)
UPLOAD_TICKET = obj(media_asset_id=UUID, upload_url=STR, storage_key=STR)
SUBMISSION = obj(id=UUID, project_id=UUID, version_id=UUID, status={"enum": ["waiting", "approved", "sent_back"]},
                 share_with=nullable(STR), grade=nullable(STR), comment=nullable(STR), submitted_by_id=UUID,
                 submitted_at=STR)
ASSIGN_CLASS = obj(assignment_id=UUID, students=INT, sent=INT)
LIBRARY_ASSET = obj(id=UUID, content_sha256=STR, storage_key=STR, kind=STR, content_type=STR, size_bytes=INT,
                    filename=STR, title=STR, visibility=STR, status=STR, url=nullable(STR))
LIBRARY_TICKET = obj(asset=LIBRARY_ASSET, upload_url=nullable(STR), upload_headers=nullable({"type": "object"}))
SHOWCASE = obj(title=STR, student_name=STR)
VISIT = obj(title=STR, student_name=STR, share_with=STR, data={"type": "object"})
VISITS = obj(project_id=UUID, visits=INT, last_7_days=array(INT))
SCHOOL = obj(id=UUID, name=STR, students=INT, educators=INT, status=STR)
ACCOUNT = obj(id=UUID, school_id=UUID, name=STR, email=STR, role=STR, class_names=array(STR),
              last_active=nullable(STR), status=STR)
SIGN_IN_LINK = obj(account_id=UUID, invite_link=nullable(STR))
IMPORT = obj(school_id=UUID, dry_run=BOOL, rows=array(obj(
    line=INT, email=STR, name=STR, role=STR, class_names=array(STR), outcome=STR,
    account_id=nullable(UUID), invite_link=nullable(STR), error=nullable(STR))))
# a new person, the "Add a student" address (known by then), and a bad role: one of each outcome
IMPORT_CSV = ("email,display_name,role,classes\n"
              "postman.csv.{{run_id}}@example.test,Postman CSV {{run_id}},student,\n"
              "postman.{{run_id}}@example.test,Again,student,\n"
              "bad.{{run_id}}@example.test,Bad,janitor,\n")
PACK = obj(id=UUID, slug=STR, title=STR, description=nullable(STR), kind={"enum": ["objects", "environments"]},
            asset_ids=array(UUID), published_revision=nullable(INT), published_at=nullable(STR),
            manifest_url=nullable(STR), unpublished_changes=BOOL, created_at=STR, updated_at=STR)
MY_PACK = obj(slug=STR, title=STR, description=nullable(STR), kind=STR, revision=INT, manifest_url=STR, item_count=INT)
RESOLVED_PACK_ASSETS = obj(assets=array(obj(id=STR, url=STR, kind=STR, content_type=STR, size_bytes=INT, title=STR,
                                            attribution=nullable(STR))), missing=array(STR))
SCHOOL_PACK = obj(id=UUID, slug=STR, title=STR, description=nullable(STR), kind=STR, item_count=INT, revision=INT,
                  enabled=BOOL)
PERMISSION = obj(key=STR, group=STR, label=STR, students=BOOL, educators=BOOL, can_adjust=BOOL, enforced=BOOL)
MY_PERMISSIONS = {"type": "object", "additionalProperties": BOOL, "required": ["from-templates"]}
OVERVIEW = obj(tiles={"type": "object", "required": ["schools", "educators", "students", "published"]},
               schools=array(SCHOOL), attention={"type": "array"}, recent={"type": "array"})

# ── Scripts ──

# runs after every request in the collection
COLLECTION_TESTS = """\
// Every request: answered within the time budget, and any body is JSON.
const budget = Number(pm.variables.get('budget_ms') || pm.environment.get('time_budget_ms') || 2000);
pm.test(`answers within ${budget} ms`, () => {
    pm.expect(pm.response.responseTime).to.be.below(budget);
});
if (pm.response.code !== 204 && pm.response.text().length > 0) {
    pm.test('body is JSON', () => {
        pm.expect(pm.response.headers.get('Content-Type') || '').to.include('application/json');
        pm.response.json();
    });
}
"""

# runs before every request: a request-level budget (set in its own pre-request) must not leak into the next
COLLECTION_PREREQUEST = "pm.variables.unset('budget_ms');"

# lasting writes (accounts, assignments, hand-ins) only where the data is throwaway
WRITES_ONLY = """\
// Leaves rows behind (an account, a student's copy, a hand-in): runs only where allow_writes is true,
// which is the seeded local and CI databases, never the deployed one by default.
if (pm.environment.get('allow_writes') !== 'true') {
    console.log(`skipped (allow_writes is not true): ${pm.info.requestName}`);
    pm.execution.skipRequest();
}
"""


def _js(lines: list[str]) -> list[str]:
    return [line for block in lines for line in block.splitlines()]


def _example(spec_key: str, original: dict) -> list[dict]:
    """The recorded exchange for this operation, as a Postman saved response (what a mock serves)."""
    recorded = EXAMPLES.get(spec_key)
    if recorded is None or recorded["status"] >= 300 and recorded["status"] != 501:
        return []
    path = spec_key.split(" ", 1)[1]
    for name, value in recorded["path_params"].items():
        path = path.replace("{" + name + "}", value)
    query = [{"key": k, "value": v} for k, v in recorded["query"].items()]
    request = {**original, "url": {
        "raw": "{{baseUrl}}" + path + ("?" + "&".join(f"{q['key']}={q['value']}" for q in query) if query else ""),
        "host": ["{{baseUrl}}"], "path": path.strip("/").split("/"), "query": query,
    }}
    if recorded["request"] is not None:
        request["body"] = {"mode": "raw", "raw": json.dumps(recorded["request"], indent=2),
                           "options": {"raw": {"language": "json"}}}
    return [{
        "name": f"Recorded {recorded['status']}",
        "originalRequest": request,
        "status": {200: "OK", 201: "Created", 204: "No Content", 501: "Not Implemented"}.get(recorded["status"], ""),
        "code": recorded["status"],
        "_postman_previewlanguage": "json",
        "header": [{"key": "Content-Type", "value": "application/json"}],
        "body": json.dumps(recorded["response"], indent=2) if recorded["response"] is not None else "",
    }]


def req(
    name: str,
    method: str,
    path: str,
    *,
    status: int,
    as_: str | None = None,
    body: dict | str | None = None,
    query: dict[str, str] | None = None,
    schema: dict | None = None,
    tests: str = "",
    prerequest: str = "",
    writes: bool = False,
    spec: str | None = None,
    budget: str | None = None,
    description: str = "",
) -> dict:
    """One request and its checks.

    as_: whose token to send (admin, teacher, student, student2), a literal header value starting with
    "raw:", or None for no Authorization header. spec: the "METHOD /path/{param}" key of the recorded
    example to save with it. writes: skip unless allow_writes is true. budget: an environment variable
    holding a larger time budget for this one request (the deployed API's cold start).
    """
    url_path = path if path.startswith("/health") else API + path
    query_list = [{"key": k, "value": v} for k, v in (query or {}).items()]
    raw = "{{baseUrl}}" + url_path + ("?" + "&".join(f"{k}={v}" for k, v in (query or {}).items()) if query else "")
    headers = []
    if as_ is not None:
        value = as_[4:] if as_.startswith("raw:") else "Bearer {{token_" + as_ + "}}"
        headers.append({"key": "Authorization", "value": value})
    request: dict = {
        "method": method,
        "header": headers,
        "url": {"raw": raw, "host": ["{{baseUrl}}"], "path": url_path.strip("/").split("/"), "query": query_list},
    }
    if body is not None:
        request["body"] = {"mode": "raw", "raw": body if isinstance(body, str) else json.dumps(body, indent=2),
                           "options": {"raw": {"language": "json"}}}
        headers.append({"key": "Content-Type", "value": "application/json"})
    if description:
        request["description"] = description

    test_lines = [f"pm.test('status is {status}', () => pm.response.to.have.status({status}));"]
    if schema is not None:
        test_lines.append(
            f"pm.test('matches the documented shape', () => pm.response.to.have.jsonSchema({json.dumps(schema)}));"
        )
    if tests:
        test_lines.append(tests)

    pre = []
    if writes:
        pre.append(WRITES_ONLY)
    if budget:
        pre.append(f"pm.variables.set('budget_ms', pm.environment.get('{budget}'));")
    if prerequest:
        pre.append(prerequest)

    events = [{"listen": "test", "script": {"type": "text/javascript", "exec": _js(test_lines)}}]
    if pre:
        events.insert(0, {"listen": "prerequest", "script": {"type": "text/javascript", "exec": _js(pre)}})
    item = {"name": name, "event": events, "request": request, "response": []}
    if spec:
        item["response"] = _example(spec, request)
    return item


def folder(name: str, description: str, items: list[dict]) -> dict:
    return {"name": name, "description": description, "item": items}


def save(var: str, expr: str) -> str:
    """Store a value from the response for later requests (collection variables live for one run)."""
    return f"pm.collectionVariables.set('{var}', {expr});"


NO_SUCH_ID = "00000000-0000-4000-8000-000000000000"
SCENE = {"schemaVersion": 1, "scenes": [{"id": "scene-1", "name": "Hall", "objects": []}]}

# ── The requests, in run order: later folders use ids that earlier ones saved ──

health = folder("Health", "Liveness. The bare /health is Render's probe; /api/v1/health is the versioned one.", [
    req("Bare health (Render probe)", "GET", "/health", status=200, schema=HEALTH, spec="GET /health",
        budget="cold_start_budget_ms",
        prerequest=save("run_id", "String(Date.now())"),
        description="First request of a run, so it carries the cold-start budget: a free Render service sleeps."),
    req("Versioned health", "GET", "/health", status=200, schema=HEALTH, spec="GET /api/v1/health"),
])
# the versioned one is /api/v1/health: build it explicitly (req() leaves /health bare)
health["item"][1]["request"]["url"] = {"raw": "{{baseUrl}}/api/v1/health", "host": ["{{baseUrl}}"],
                                       "path": ["api", "v1", "health"], "query": []}

auth = folder("Auth", "Signed-out and badly signed-in callers get 401, never data.", [
    req("No token is 401", "GET", "/me", status=401, schema=ERROR,
        tests="pm.test('says how to authenticate', () => pm.expect(pm.response.headers.get('WWW-Authenticate')).to.include('Bearer'));"),
    req("Garbage token is 401", "GET", "/me", as_="raw:Bearer not-a-real-token", status=401, schema=ERROR),
    req("Malformed JWT is 401", "GET", "/me", as_="raw:Bearer not-a-jwt", status=401, schema=ERROR,
        description="Not a JWT at all, so it fails before the signing keys are fetched: 401 with or without Auth0 configured."),
    req("Protected list without token is 401", "GET", "/projects", status=401, schema=ERROR),
])

me = folder("Me", "Who each token belongs to. Saves the ids the later folders need.", [
    req("Admin", "GET", "/me", as_="admin", status=200, schema=ME, spec="GET /api/v1/me", budget="cold_start_budget_ms", tests="\n".join([
        "const me = pm.response.json();",
        "pm.test('is an admin', () => pm.expect(me.role).to.eql('admin'));",
        save("admin_id", "me.id"), save("school_id", "me.organisation_id"),
    ])),
    req("Teacher", "GET", "/me", as_="teacher", status=200, schema=ME, tests="\n".join([
        "const me = pm.response.json();",
        "pm.test('is a teacher in a class', () => { pm.expect(me.role).to.eql('teacher'); pm.expect(me.class_ids).to.not.be.empty; });",
        save("teacher_id", "me.id"), save("teacher_class_ids", "JSON.stringify(me.class_ids)"),
    ])),
    req("Student", "GET", "/me", as_="student", status=200, schema=ME, tests="\n".join([
        "const me = pm.response.json();",
        "const taught = JSON.parse(pm.collectionVariables.get('teacher_class_ids') || '[]');",
        "const shared = me.class_ids.find((id) => taught.includes(id));",
        "pm.test('is a student in one of the teacher\\'s classes', () => { pm.expect(me.role).to.eql('student'); pm.expect(shared).to.be.a('string'); });",
        save("student_id", "me.id"), save("class_id", "shared"),
    ])),
    req("Second student", "GET", "/me", as_="student2", status=200, schema=ME, tests="\n".join([
        "const me = pm.response.json();",
        "pm.test('is a different student', () => { pm.expect(me.role).to.eql('student'); pm.expect(me.id).to.not.eql(pm.collectionVariables.get('student_id')); });",
        save("student2_id", "me.id"),
    ])),
])

classes = folder("Classes", "Rosters: teachers see their classes; students may not list one.", [
    req("Teacher lists classes", "GET", "/classes", as_="teacher", status=200, schema=array(CLASS), spec="GET /api/v1/classes",
        tests="pm.test('includes the shared class', () => pm.expect(pm.response.json().map((c) => c.id)).to.include(pm.collectionVariables.get('class_id')));"),
    req("Teacher lists the roster", "GET", "/classes/{{class_id}}/members", as_="teacher", status=200, schema=array(MEMBER),
        spec="GET /api/v1/classes/{class_id}/members",
        tests="pm.test('the student is on it', () => pm.expect(pm.response.json().map((m) => m.id)).to.include(pm.collectionVariables.get('student_id')));"),
    req("Student may not list the roster (403)", "GET", "/classes/{{class_id}}/members", as_="student", status=403, schema=ERROR),
    req("Unknown class is 404", "GET", f"/classes/{NO_SUCH_ID}/members", as_="teacher", status=404, schema=ERROR),
    req("Student may not create a class (403)", "POST", "/classes", as_="student", status=403, schema=ERROR,
        body={"name": "Mine"}),
    req("Admin must pick a school (422)", "POST", "/classes", as_="admin", status=422, schema=ERROR,
        body={"name": "No school"}),
    req("Teacher creates a class", "POST", "/classes", as_="teacher", status=201, schema=CLASS, writes=True,
        spec="POST /api/v1/classes", body='{\n  "name": "Postman class {{run_id}}"\n}',
        tests="\n".join([
            "pm.test('the teacher teaches it', () => pm.expect(pm.response.json().member_count).to.eql(1));",
            save("new_class_id", "pm.response.json().id"),
        ])),
    req("Same class name is 409", "POST", "/classes", as_="teacher", status=409, schema=ERROR, writes=True,
        body='{\n  "name": "Postman class {{run_id}}"\n}'),
    req("Teacher adds the second student", "POST", "/classes/{{new_class_id}}/members", as_="teacher", status=200,
        schema=MEMBER, writes=True, spec="POST /api/v1/classes/{class_id}/members",
        body='{\n  "actor_id": "{{student2_id}}"\n}'),
    req("Teacher may not add the admin (403)", "POST", "/classes/{{new_class_id}}/members", as_="teacher", status=403,
        schema=ERROR, writes=True, body='{\n  "actor_id": "{{admin_id}}"\n}'),
    req("Teacher removes them again", "DELETE", "/classes/{{new_class_id}}/members/{{student2_id}}", as_="teacher",
        status=204, writes=True),
    req("Removing someone not there is 404", "DELETE", "/classes/{{new_class_id}}/members/{{student2_id}}",
        as_="teacher", status=404, schema=ERROR, writes=True),
    req("Put them back in the new class", "POST", "/classes/{{new_class_id}}/members", as_="teacher", status=200,
        schema=MEMBER, writes=True, body='{\n  "actor_id": "{{student2_id}}"\n}'),
    req("Move them to the shared class", "POST", "/classes/{{new_class_id}}/members/{{student2_id}}/move",
        as_="teacher", status=200, schema=MOVE, writes=True,
        spec="POST /api/v1/classes/{class_id}/members/{actor_id}/move", body='{\n  "to_class_id": "{{class_id}}"\n}',
        tests="pm.test('lands in the shared class', () => pm.expect(pm.response.json().to_class.id).to.eql(pm.collectionVariables.get('class_id')));"),
    req("Moving again is 404 (not in the new class)", "POST", "/classes/{{new_class_id}}/members/{{student2_id}}/move",
        as_="teacher", status=404, schema=ERROR, writes=True, body='{\n  "to_class_id": "{{class_id}}"\n}'),
    req("Moving into the same class is 422", "POST", "/classes/{{class_id}}/members/{{student2_id}}/move",
        as_="teacher", status=422, schema=ERROR, writes=True, body='{\n  "to_class_id": "{{class_id}}"\n}'),
    req("Bad class id is 422", "GET", "/classes/not-a-uuid/members", as_="teacher", status=422, schema=VALIDATION_ERROR),
])

projects = folder("Projects", "A student's project, start to finish: create, save, conflict, read, rename, who may not, pagination, delete.", [
    req("Student creates a project", "POST", "/projects", as_="student", status=201, schema=PROJECT, spec="POST /api/v1/projects",
        body='{\n  "name": "Postman museum {{run_id}}",\n  "class_id": "{{class_id}}"\n}',
        tests="\n".join([
            "const p = pm.response.json();",
            "pm.test('is an empty draft in the class', () => { pm.expect(p.status).to.eql('draft'); pm.expect(p.current_revision).to.eql(0); pm.expect(p.class_id).to.eql(pm.collectionVariables.get('class_id')); });",
            save("project_id", "p.id"),
        ])),
    req("Save revision 1", "POST", "/projects/{{project_id}}/versions", as_="student", status=201, schema=VERSION,
        spec="POST /api/v1/projects/{project_id}/versions", body={"base_revision": 0, "data": SCENE},
        tests="\n".join([
            "pm.test('is revision 1', () => pm.expect(pm.response.json().revision).to.eql(1));",
            save("version_id", "pm.response.json().id"),
        ])),
    req("Stale save is 409", "POST", "/projects/{{project_id}}/versions", as_="student", status=409, schema=ERROR,
        body={"base_revision": 0, "data": SCENE},
        description="Two tabs saving the same project: the second, still on revision 0, is refused rather than overwriting.",
        tests="pm.test('reports the current revision', () => pm.expect(pm.response.json().detail.current_revision).to.eql(1));"),
    req("Save without schemaVersion is 422", "POST", "/projects/{{project_id}}/versions", as_="student", status=422, schema=ERROR,
        body={"base_revision": 1, "data": {"scenes": []}}),
    req("Read it back", "GET", "/projects/{{project_id}}", as_="student", status=200, schema=PROJECT,
        spec="GET /api/v1/projects/{project_id}",
        tests="pm.test('is at revision 1', () => pm.expect(pm.response.json().current_revision).to.eql(1));"),
    req("List versions", "GET", "/projects/{{project_id}}/versions", as_="student", status=200, schema=array(VERSION),
        spec="GET /api/v1/projects/{project_id}/versions",
        tests="pm.test('has one', () => pm.expect(pm.response.json()).to.have.lengthOf(1));"),
    req("Read a version's scene", "GET", "/projects/{{project_id}}/versions/{{version_id}}", as_="student", status=200,
        schema=VERSION_DETAIL, spec="GET /api/v1/projects/{project_id}/versions/{version_id}",
        tests="pm.test('round-trips the saved scene', () => pm.expect(pm.response.json().data.scenes[0].name).to.eql('Hall'));"),
    req("Rename", "PATCH", "/projects/{{project_id}}", as_="student", status=200, schema=PROJECT,
        spec="PATCH /api/v1/projects/{project_id}", body='{\n  "name": "Renamed museum {{run_id}}"\n}',
        tests="pm.test('has the new name', () => pm.expect(pm.response.json().name).to.include('Renamed museum'));"),
    req("Teacher reads the student's project", "GET", "/projects/{{project_id}}", as_="teacher", status=200, schema=PROJECT,
        description="A teacher sees work filed under one of their classes."),
    req("Teacher may not change it (403)", "PATCH", "/projects/{{project_id}}", as_="teacher", status=403, schema=ERROR,
        body={"name": "Not yours"}),
    req("Another student cannot see it (404)", "GET", "/projects/{{project_id}}", as_="student2", status=404, schema=ERROR,
        description="404, not 403: an id the caller may not see is not confirmed to exist."),
    req("Student may not make a template (403)", "POST", "/projects", as_="student", status=403, schema=ERROR,
        body={"name": "Template attempt", "kind": "template"}),
    req("Missing name is 422", "POST", "/projects", as_="student", status=422, schema=VALIDATION_ERROR, body={}),
    req("Unknown project is 404", "GET", f"/projects/{NO_SUCH_ID}", as_="student", status=404, schema=ERROR),
    req("Bad project id is 422", "GET", "/projects/not-a-uuid", as_="student", status=422, schema=VALIDATION_ERROR),
    req("Page 1 of my projects", "GET", "/projects", as_="student", status=200, schema=array(PROJECT),
        spec="GET /api/v1/projects", query={"mine": "true", "limit": "1", "offset": "0"},
        tests="\n".join([
            "const total = Number(pm.response.headers.get('X-Total-Count'));",
            "pm.test('X-Total-Count is the size before paging', () => pm.expect(total).to.be.at.least(1));",
            "pm.test('limit=1 returns one', () => pm.expect(pm.response.json()).to.have.lengthOf(1));",
            save("my_total", "total"),
        ])),
    req("Past the last page is empty", "GET", "/projects", as_="student", status=200, schema=array(PROJECT),
        query={"mine": "true", "limit": "1", "offset": "{{my_total}}"},
        tests="\n".join([
            "pm.test('no rows', () => pm.expect(pm.response.json()).to.be.empty);",
            "pm.test('total unchanged', () => pm.expect(pm.response.headers.get('X-Total-Count')).to.eql(String(pm.collectionVariables.get('my_total'))));",
        ])),
    req("limit=0 is 422", "GET", "/projects", as_="student", status=422, schema=VALIDATION_ERROR, query={"limit": "0"}),
    req("limit over 200 is 422", "GET", "/projects", as_="student", status=422, schema=VALIDATION_ERROR, query={"limit": "201"}),
    req("Delete the draft", "DELETE", "/projects/{{project_id}}", as_="student", status=204,
        spec="DELETE /api/v1/projects/{project_id}"),
    req("Gone after delete (404)", "GET", "/projects/{{project_id}}", as_="student", status=404, schema=ERROR),
])

media = folder("Media", "A teacher's project with an upload ticket and a YouTube link that needs approval.", [
    req("Teacher creates a project", "POST", "/projects", as_="teacher", status=201, schema=PROJECT,
        body='{\n  "name": "Postman media {{run_id}}"\n}', tests=save("media_project_id", "pm.response.json().id")),
    req("Upload ticket for an image", "POST", "/projects/{{media_project_id}}/media", as_="teacher", status=201,
        schema=UPLOAD_TICKET, spec="POST /api/v1/projects/{project_id}/media",
        body={"kind": "image", "content_type": "image/png", "size_bytes": 1000, "filename": "stone.png"},
        tests="\n".join([
            "pm.test('presigned PUT for this project', () => pm.expect(pm.response.json().storage_key).to.include(pm.collectionVariables.get('media_project_id')));",
            save("media_id", "pm.response.json().media_asset_id"),
        ])),
    req("Audio is not uploaded here (422)", "POST", "/projects/{{media_project_id}}/media", as_="teacher", status=422,
        schema=ERROR, body={"kind": "audio", "content_type": "audio/mpeg", "size_bytes": 1000, "filename": "x.mp3"}),
    req("Empty file is 422", "POST", "/projects/{{media_project_id}}/media", as_="teacher", status=422, schema=ERROR,
        body={"kind": "image", "content_type": "image/png", "size_bytes": 0, "filename": "empty.png"}),
    req("Confirm before upload is 409", "POST", "/projects/{{media_project_id}}/media/{{media_id}}/confirm", as_="teacher",
        status=409, schema=ERROR, budget="cold_start_budget_ms",
        description="Nothing was PUT to the presigned URL, so the API will not mark it uploaded. The run's first call "
                    "that reaches object storage, so it gets the cold-start budget (the storage client connects here)."),
    req("Add a YouTube link", "POST", "/projects/{{media_project_id}}/media/links", as_="teacher", status=201, schema=MEDIA,
        spec="POST /api/v1/projects/{project_id}/media/links", body={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        tests="\n".join([
            "pm.test('waits for approval', () => pm.expect(pm.response.json().approval).to.eql('pending'));",
            save("link_id", "pm.response.json().id"),
        ])),
    req("Same link twice is 409", "POST", "/projects/{{media_project_id}}/media/links", as_="teacher", status=409, schema=ERROR,
        body={"url": "https://youtu.be/dQw4w9WgXcQ"}),
    req("Not a video link is 422", "POST", "/projects/{{media_project_id}}/media/links", as_="teacher", status=422, schema=ERROR,
        body={"url": "https://example.com/cat.gif"}),
    req("Approve the link", "PATCH", "/projects/{{media_project_id}}/media/links/{{link_id}}", as_="teacher", status=200,
        schema=MEDIA, spec="PATCH /api/v1/projects/{project_id}/media/links/{link_id}", body={"approval": "approved"},
        tests="pm.test('is approved', () => pm.expect(pm.response.json().approval).to.eql('approved'));"),
    req("List the project's media", "GET", "/projects/{{media_project_id}}/media", as_="teacher", status=200,
        schema=array(MEDIA), spec="GET /api/v1/projects/{project_id}/media",
        tests="pm.test('has the file and the link', () => pm.expect(pm.response.json()).to.have.lengthOf(2));"),
    req("Unknown media is 404", "GET", f"/projects/{{{{media_project_id}}}}/media/{NO_SUCH_ID}", as_="teacher", status=404, schema=ERROR),
    req("Student cannot see the teacher's project media (404)", "GET", "/projects/{{media_project_id}}/media", as_="student",
        status=404, schema=ERROR),
    req("Delete the upload", "DELETE", "/projects/{{media_project_id}}/media/{{media_id}}", as_="teacher", status=204,
        spec="DELETE /api/v1/projects/{project_id}/media/{media_id}"),
    req("Delete the link", "DELETE", "/projects/{{media_project_id}}/media/{{link_id}}", as_="teacher", status=204),
    req("Delete the project", "DELETE", "/projects/{{media_project_id}}", as_="teacher", status=204),
])

submissions = folder("Submissions", "Assign → hand in → send back → hand in → approve → public visit. Leaves rows behind, so only where allow_writes is true.", [
    req("Teacher creates a class project", "POST", "/projects", as_="teacher", status=201, schema=PROJECT, writes=True,
        body='{\n  "name": "Postman assignment {{run_id}}",\n  "class_id": "{{class_id}}"\n}',
        tests=save("source_id", "pm.response.json().id")),
    req("Teacher saves the setup", "POST", "/projects/{{source_id}}/versions", as_="teacher", status=201, schema=VERSION,
        writes=True, body={"base_revision": 0, "data": SCENE}),
    req("Send it to the student", "POST", "/projects/{{source_id}}/assign", as_="teacher", status=201, schema=PROJECT,
        writes=True, spec="POST /api/v1/projects/{project_id}/assign",
        body='{\n  "student_id": "{{student_id}}",\n  "task": "Build a museum (Postman run {{run_id}})"\n}',
        tests="\n".join([
            "const copy = pm.response.json();",
            "pm.test('the copy belongs to the student', () => pm.expect(copy.created_by_id).to.eql(pm.collectionVariables.get('student_id')));",
            save("copy_id", "copy.id"), save("copy_slug", "copy.slug"),
        ])),
    req("Student may not assign (403)", "POST", "/projects/{{source_id}}/assign", as_="student", status=403, schema=ERROR,
        writes=True, body='{\n  "student_id": "{{student2_id}}"\n}'),
    req("Sent work cannot be deleted (409)", "DELETE", "/projects/{{source_id}}", as_="teacher", status=409, schema=ERROR,
        writes=True),
    req("Student hands it in", "POST", "/projects/{{copy_id}}/submit", as_="student", status=201, schema=SUBMISSION,
        writes=True, spec="POST /api/v1/projects/{project_id}/submit", body={"share_with": "public"},
        tests="pm.test('waits', () => pm.expect(pm.response.json().status).to.eql('waiting'));"),
    req("Handing in twice is 409", "POST", "/projects/{{copy_id}}/submit", as_="student", status=409, schema=ERROR,
        writes=True, body={}),
    req("Student may not approve own work (403)", "POST", "/projects/{{copy_id}}/approve", as_="student", status=403,
        schema=ERROR, writes=True, body={"grade": "A"}),
    req("Send back needs a comment (422)", "POST", "/projects/{{copy_id}}/send-back", as_="teacher", status=422,
        schema=VALIDATION_ERROR, writes=True, body={}),
    req("Teacher sends it back", "POST", "/projects/{{copy_id}}/send-back", as_="teacher", status=200, schema=SUBMISSION,
        writes=True, spec="POST /api/v1/projects/{project_id}/send-back", body={"comment": "Add a second room"},
        tests="pm.test('is sent back', () => pm.expect(pm.response.json().status).to.eql('sent_back'));"),
    req("Student hands it in again", "POST", "/projects/{{copy_id}}/submit", as_="student", status=201, schema=SUBMISSION,
        writes=True, body={"share_with": "public"},
        description="share_with is sent again: a resubmit carries it over only from an approved hand-in, not a sent-back one."),
    req("Teacher lists the hand-ins", "GET", "/projects/{{copy_id}}/submissions", as_="teacher", status=200,
        schema=array(SUBMISSION), writes=True, spec="GET /api/v1/projects/{project_id}/submissions",
        tests="pm.test('newest first: waiting, then sent back', () => pm.expect(pm.response.json().map((s) => s.status)).to.eql(['waiting', 'sent_back']));"),
    req("Teacher approves", "POST", "/projects/{{copy_id}}/approve", as_="teacher", status=200, schema=SUBMISSION,
        writes=True, spec="POST /api/v1/projects/{project_id}/approve", body={"grade": "A", "comment": "Lovely"},
        tests="pm.test('is approved and public', () => { const s = pm.response.json(); pm.expect(s.status).to.eql('approved'); pm.expect(s.share_with).to.eql('public'); });"),
    req("Taking back an approved one is 409", "DELETE", "/projects/{{copy_id}}/submit", as_="student", status=409,
        schema=ERROR, writes=True),
    req("Anyone can visit it now, no token", "GET", "/visit/{{copy_slug}}", status=200, schema=VISIT, writes=True,
        spec="GET /api/v1/visit/{slug}",
        tests="pm.test('carries the saved scene', () => pm.expect(pm.response.json().data.scenes).to.be.an('array'));"),
])

public = folder("Public", "What the sign-in page and a visitor read without signing in.", [
    req("Showcase", "GET", "/showcase", status=200, schema=array(SHOWCASE), spec="GET /api/v1/showcase"),
    req("Unknown visit link is 404", "GET", "/visit/no-such-museum-0000", status=404, schema=ERROR),
])

analytics = folder("Analytics", "Visit counts for teachers.", [
    req("Teacher reads visits", "GET", "/analytics/visits", as_="teacher", status=200, schema=array(VISITS),
        spec="GET /api/v1/analytics/visits", query={"days": "7"}),
    req("Student may not (403)", "GET", "/analytics/visits", as_="student", status=403, schema=ERROR, query={"days": "7"}),
    req("days=0 is 422", "GET", "/analytics/visits", as_="teacher", status=422, schema=VALIDATION_ERROR, query={"days": "0"}),
    req("Unbuilt route says 501", "GET", "/projects/{{class_id}}/analytics/summary", as_="teacher", status=501, schema=ERROR,
        spec="GET /api/v1/projects/{project_id}/analytics/summary",
        description="Ten routes are documented but not built; they answer 501 rather than pretending."),
])

library = folder("Library", "The admin-curated asset library.", [
    req("Admin lists the library", "GET", "/library", as_="admin", status=200, schema=array(LIBRARY_ASSET),
        spec="GET /api/v1/library"),
    req("Teacher may not (403)", "GET", "/library", as_="teacher", status=403, schema=ERROR),
    req("Unknown kind is 422", "GET", "/library", as_="admin", status=422, schema=ERROR, query={"kind": "spaceship"}),
    req("Bad checksum is 422", "POST", "/library/tickets", as_="admin", status=422, schema=ERROR,
        body={"content_sha256": "nothex", "filename": "Pedestal.glb", "kind": "model",
              "content_type": "model/gltf-binary", "size_bytes": 15}),
    req("Ticket for a model", "POST", "/library/tickets", as_="admin", status=201, schema=LIBRARY_TICKET, writes=True,
        spec="POST /api/v1/library/tickets",
        prerequest="// a checksum unique to this run, so the ticket is always new\n"
                   "pm.variables.set('sha', CryptoJS.SHA256(pm.collectionVariables.get('run_id')).toString());",
        body='{\n  "content_sha256": "{{sha}}",\n  "filename": "Postman.glb",\n  "kind": "model",\n'
             '  "content_type": "model/gltf-binary",\n  "size_bytes": 15\n}',
        tests=save("library_asset_id", "pm.response.json().asset.id")),
    req("Rename it", "PATCH", "/library/{{library_asset_id}}", as_="admin", status=200, schema=LIBRARY_ASSET, writes=True,
        spec="PATCH /api/v1/library/{asset_id}", body={"title": "Renamed by Postman"},
        tests="pm.test('has the new title', () => pm.expect(pm.response.json().title).to.eql('Renamed by Postman'));"),
    req("Delete it", "DELETE", "/library/{{library_asset_id}}", as_="admin", status=204, writes=True,
        spec="DELETE /api/v1/library/{asset_id}"),
    req("Unknown asset is 404", "DELETE", f"/library/{NO_SUCH_ID}", as_="admin", status=404, schema=ERROR),
])

packs = folder("Packs", "Asset packs: an admin drafts one, and a school switches published ones on. Publishing is not run "
               "here: a published pack cannot be deleted, and the local and CI runs have no public bucket address.", [
    req("Admin lists packs", "GET", "/packs", as_="admin", status=200, schema=array(PACK), spec="GET /api/v1/packs"),
    req("Teacher may not (403)", "GET", "/packs", as_="teacher", status=403, schema=ERROR),
    req("Student reads the school's packs", "GET", "/packs/mine", as_="student", status=200, schema=array(MY_PACK),
        spec="GET /api/v1/packs/mine", description="Anyone signed in: the published packs their own school has switched on."),
    req("Anyone resolves pack assets (no token)", "POST", "/packs/resolve", status=200, schema=RESOLVED_PACK_ASSETS,
        spec="POST /api/v1/packs/resolve",
        body={"ids": [f"pack:postman-none:{NO_SUCH_ID}", "bundled-model"]},
        description="A visitor has no token. Ids the server cannot serve (unknown pack, not published, not a pack id) "
                    "come back in missing, never as an error; the browser reads that as gone for good.",
        tests="pm.test('both are reported missing', () => { const r = pm.response.json(); pm.expect(r.assets).to.eql([]); pm.expect(r.missing.length).to.eql(2); });"),
    req("Resolve with no ids is 422", "POST", "/packs/resolve", status=422, schema=ERROR, body={"ids": []}),
    req("Bad short name is 422", "POST", "/packs", as_="admin", status=422, schema=ERROR,
        body={"slug": "Not OK", "title": "Bad name"}),
    req("Admin drafts a pack", "POST", "/packs", as_="admin", status=201, schema=PACK, spec="POST /api/v1/packs",
        body='{\n  "slug": "postman-{{run_id}}",\n  "title": "Postman pack {{run_id}}",\n  "kind": "objects"\n}',
        tests="\n".join([
            "const pack = pm.response.json();",
            "pm.test('is an unpublished draft', () => { pm.expect(pack.published_revision).to.eql(null); pm.expect(pack.unpublished_changes).to.eql(true); });",
            save("pack_slug", "pack.slug"),
        ])),
    req("Same short name twice is 409", "POST", "/packs", as_="admin", status=409, schema=ERROR,
        body='{\n  "slug": "{{pack_slug}}",\n  "title": "Again"\n}'),
    req("Read the draft", "GET", "/packs/{{pack_slug}}", as_="admin", status=200, schema=PACK, spec="GET /api/v1/packs/{slug}"),
    req("Rename the pack", "PATCH", "/packs/{{pack_slug}}", as_="admin", status=200, schema=PACK, spec="PATCH /api/v1/packs/{slug}",
        body={"title": "Renamed by Postman"},
        tests="pm.test('has the new title', () => pm.expect(pm.response.json().title).to.eql('Renamed by Postman'));"),
    req("Set its files (none)", "PUT", "/packs/{{pack_slug}}/assets", as_="admin", status=200, schema=PACK,
        spec="PUT /api/v1/packs/{slug}/assets", body={"asset_ids": []},
        tests="pm.test('holds nothing', () => pm.expect(pm.response.json().asset_ids).to.be.empty);"),
    req("A file not in the library is 422", "PUT", "/packs/{{pack_slug}}/assets", as_="admin", status=422, schema=ERROR,
        body={"asset_ids": [NO_SUCH_ID]}),
    req("Publishing an empty pack is 422", "POST", "/packs/{{pack_slug}}/publish", as_="admin", status=422, schema=ERROR),
    req("Delete the draft pack", "DELETE", "/packs/{{pack_slug}}", as_="admin", status=204, spec="DELETE /api/v1/packs/{slug}"),
    req("Pack gone after delete (404)", "GET", "/packs/{{pack_slug}}", as_="admin", status=404, schema=ERROR),
    req("School's pack switches", "GET", "/admin/schools/{{school_id}}/packs", as_="admin", status=200,
        schema=array(SCHOOL_PACK), spec="GET /api/v1/admin/schools/{school}/packs",
        description="Published packs only, each with whether this school has it on."),
    req("Another school's switches are 404", "GET", f"/admin/schools/{NO_SUCH_ID}/packs", as_="admin", status=404, schema=ERROR),
    req("Switching an unknown pack is 404", "PATCH", f"/admin/schools/{{{{school_id}}}}/packs/{NO_SUCH_ID}", as_="admin",
        status=404, schema=ERROR, body={"enabled": True}),
])

admin = folder("Admin", "School overview and accounts, admins only.", [
    req("Overview", "GET", "/admin/overview", as_="admin", status=200, schema=OVERVIEW, spec="GET /api/v1/admin/overview"),
    req("Schools", "GET", "/admin/schools", as_="admin", status=200, schema=array(SCHOOL), spec="GET /api/v1/admin/schools"),
    req("Accounts", "GET", "/admin/accounts", as_="admin", status=200, schema=array(ACCOUNT), spec="GET /api/v1/admin/accounts",
        tests="pm.test('lists the student', () => pm.expect(pm.response.json().map((a) => a.id)).to.include(pm.collectionVariables.get('student_id')));"),
    req("Teacher may not (403)", "GET", "/admin/accounts", as_="teacher", status=403, schema=ERROR),
    req("Another school is 404", "GET", "/admin/accounts", as_="admin", status=404, schema=ERROR, query={"school": NO_SUCH_ID}),
    req("Add a student", "POST", "/admin/accounts", as_="admin", status=201, schema=ACCOUNT, writes=True,
        spec="POST /api/v1/admin/accounts",
        body='{\n  "school_id": "{{school_id}}",\n  "name": "Postman Student {{run_id}}",\n'
             '  "email": "postman.{{run_id}}@example.test",\n  "role": "student",\n  "class_names": []\n}',
        tests="\n".join([
            "pm.test('starts invited', () => pm.expect(pm.response.json().status).to.eql('invited'));",
            save("account_id", "pm.response.json().id"),
        ])),
    req("Same email twice is 409", "POST", "/admin/accounts", as_="admin", status=409, schema=ERROR, writes=True,
        body='{\n  "school_id": "{{school_id}}",\n  "name": "Again",\n  "email": "postman.{{run_id}}@example.test",\n'
             '  "role": "student"\n}'),
    req("Unknown role is 422", "POST", "/admin/accounts", as_="admin", status=422, schema=ERROR,
        body='{\n  "school_id": "{{school_id}}",\n  "name": "X",\n  "email": "x.{{run_id}}@example.test",\n  "role": "janitor"\n}'),
    req("New sign-in link", "POST", "/admin/accounts/{{account_id}}/invite", as_="admin", status=200,
        schema=SIGN_IN_LINK, writes=True, spec="POST /api/v1/admin/accounts/{account_id}/invite",
        tests="pm.test('for this account', () => pm.expect(pm.response.json().account_id).to.eql(pm.variables.get('account_id')));"),
    req("Teacher may not hand out sign-in links (403)", "POST", "/admin/accounts/{{account_id}}/invite", as_="teacher",
        status=403, schema=ERROR),
    req("Sign-in link for nobody is 404", "POST", f"/admin/accounts/{NO_SUCH_ID}/invite", as_="admin", status=404,
        schema=ERROR),
    req("Turn the account off", "PATCH", "/admin/accounts/{{account_id}}", as_="admin", status=200, schema=ACCOUNT,
        writes=True, spec="PATCH /api/v1/admin/accounts/{account_id}", body={"active": False},
        tests="pm.test('is turned off', () => pm.expect(pm.response.json().status).to.eql('turned_off'));"),
    req("No sign-in link while turned off (409)", "POST", "/admin/accounts/{{account_id}}/invite", as_="admin",
        status=409, schema=ERROR, writes=True),
    req("Import CSV: dry run", "POST", "/admin/accounts/import", as_="admin", status=200, schema=IMPORT,
        spec="POST /api/v1/admin/accounts/import", body={"school_id": "{{school_id}}", "csv": IMPORT_CSV, "dry_run": True},
        tests="pm.test('one outcome per line, nothing made', () => pm.expect(pm.response.json().rows.map((r) => r.outcome))"
              ".to.eql(['would_create', 'skipped_exists', 'error']));"),
    req("Import CSV: apply", "POST", "/admin/accounts/import", as_="admin", status=200, schema=IMPORT, writes=True,
        body={"school_id": "{{school_id}}", "csv": IMPORT_CSV, "dry_run": False},
        tests="pm.test('creates the new one, skips the known one', () => pm.expect(pm.response.json().rows.map((r) => r.outcome))"
              ".to.eql(['created', 'skipped_exists', 'error']));"),
    req("Teacher may not import (403)", "POST", "/admin/accounts/import", as_="teacher", status=403, schema=ERROR,
        body={"school_id": "{{school_id}}", "csv": IMPORT_CSV, "dry_run": True}),
    req("CSV without the columns is 422", "POST", "/admin/accounts/import", as_="admin", status=422, schema=ERROR,
        body={"school_id": "{{school_id}}", "csv": "name,email\nX,x@example.test\n", "dry_run": True}),
    req("Cannot turn yourself off (400)", "PATCH", "/admin/accounts/{{admin_id}}", as_="admin", status=400, schema=ERROR,
        body={"active": False}),
    req("Unknown account is 404", "PATCH", f"/admin/accounts/{NO_SUCH_ID}", as_="admin", status=404, schema=ERROR,
        body={"active": False}),
    req("Add a school", "POST", "/admin/schools", as_="admin", status=201, schema=SCHOOL, writes=True,
        spec="POST /api/v1/admin/schools", body='{\n  "name": "Postman School {{run_id}}"\n}',
        tests="\n".join([
            "pm.test('starts empty, setting up', () => { const s = pm.response.json(); pm.expect(s.students + s.educators).to.eql(0); pm.expect(s.status).to.eql('setting_up'); });",
            save("new_school_id", "pm.response.json().id"),
        ])),
    req("Same school name is 409", "POST", "/admin/schools", as_="admin", status=409, schema=ERROR, writes=True,
        body='{\n  "name": "Postman School {{run_id}}"\n}'),
    req("The new school has nobody yet", "GET", "/admin/accounts", as_="admin", status=200, schema=array(ACCOUNT),
        writes=True, query={"school": "{{new_school_id}}"},
        tests="pm.test('is empty', () => pm.expect(pm.response.json()).to.eql([]));"),
    req("Teacher may not add a school (403)", "POST", "/admin/schools", as_="teacher", status=403, schema=ERROR,
        body={"name": "Nope"}),
])

FT = "from-templates"
FT_BODY = ('[\n  {\n    "key": "' + FT + '",\n    "students": %s,\n    "educators": {{ft_educators}},\n'
           '    "can_adjust": {{ft_can_adjust}}\n  }\n]')
permissions = folder("Permissions", "What each role may do in one school. Only \"Set up projects from templates\" is "
                     "enforced so far: a student starting a copy of a template. The last five turn that switch off for "
                     "students and put it back, so they run only where allow_writes is true.", [
    req("Admin reads the settings", "GET", "/admin/schools/{{school_id}}/permissions", as_="admin", status=200,
        schema=array(PERMISSION), spec="GET /api/v1/admin/schools/{school}/permissions", tests="\n".join([
            "const rows = pm.response.json();",
            f"const ft = rows.find((r) => r.key === '{FT}');",
            "pm.test('has all 9 settings', () => pm.expect(rows).to.have.lengthOf(9));",
            "pm.test('templates is the enforced one', () => pm.expect(rows.filter((r) => r.enforced).map((r) => r.key)).to.eql([ft.key]));",
            # kept so the last request can put the school back exactly as it was
            save("ft_students", "String(ft.students)"), save("ft_educators", "String(ft.educators)"),
            save("ft_can_adjust", "String(ft.can_adjust)"),
        ])),
    req("Teacher may not read them (403)", "GET", "/admin/schools/{{school_id}}/permissions", as_="teacher", status=403, schema=ERROR),
    req("Another school's settings are 404", "GET", f"/admin/schools/{NO_SUCH_ID}/permissions", as_="admin", status=404, schema=ERROR),
    req("All schools is 404", "GET", "/admin/schools/all/permissions", as_="admin", status=404, schema=ERROR,
        description="Settings belong to one school, so the All schools filter is not accepted here."),
    req("Unknown setting is 422, nothing saved", "PUT", "/admin/schools/{{school_id}}/permissions", as_="admin", status=422,
        schema=ERROR, body=[{"key": "fly-to-the-moon", "students": True, "educators": True}]),
    req("Admin may do everything", "GET", "/permissions/mine", as_="admin", status=200, schema=MY_PERMISSIONS,
        spec="GET /api/v1/permissions/mine",
        tests="pm.test('all true', () => pm.expect(Object.values(pm.response.json())).to.not.include(false));"),
    req("Teacher's own answer matches the school", "GET", "/permissions/mine", as_="teacher", status=200, schema=MY_PERMISSIONS,
        tests=f"pm.test('templates follows the educators switch', () => pm.expect(String(pm.response.json()['{FT}'])).to.eql(pm.collectionVariables.get('ft_educators')));"),
    req("Student finds a template", "GET", "/projects", as_="student", status=200, schema=array(PROJECT), writes=True,
        query={"kind": "template", "status": "published", "limit": "1"},
        tests="\n".join([
            "const found = pm.response.json();",
            "pm.test('the school has a published template', () => pm.expect(found).to.have.lengthOf(1));",
            save("template_id", "found[0] && found[0].id"),
        ])),
    req("Turn templates off for students", "PUT", "/admin/schools/{{school_id}}/permissions", as_="admin", status=200,
        schema=array(PERMISSION), writes=True, spec="PUT /api/v1/admin/schools/{school}/permissions",
        body=FT_BODY % "false",
        tests=f"pm.test('saved', () => pm.expect(pm.response.json().find((r) => r.key === '{FT}').students).to.eql(false));"),
    req("Student's own answer says no", "GET", "/permissions/mine", as_="student", status=200, schema=MY_PERMISSIONS, writes=True,
        tests=f"pm.test('templates is false', () => pm.expect(pm.response.json()['{FT}']).to.eql(false));"),
    req("Student may not copy the template (403)", "POST", "/projects", as_="student", status=403, schema=ERROR, writes=True,
        body='{\n  "name": "Postman copy {{run_id}}",\n  "template_id": "{{template_id}}"\n}',
        tests="pm.test('says why', () => pm.expect(pm.response.json().detail).to.include('templates'));"),
    req("Put the setting back", "PUT", "/admin/schools/{{school_id}}/permissions", as_="admin", status=200,
        schema=array(PERMISSION), writes=True, body=FT_BODY % "{{ft_students}}",
        tests=f"pm.test('as it was', () => pm.expect(String(pm.response.json().find((r) => r.key === '{FT}').students)).to.eql(pm.collectionVariables.get('ft_students')));"),
])

COLLECTION = {
    "info": {
        "name": "VectorSpace API v1",
        "description": (
            "A second client of the same /api/v1 the web app uses, unchanged. Generated by "
            "apps/api/postman/build_collection.py; edit that, not this file.\n\n"
            "Run order matters: Me saves the ids later folders use. Data is the synthetic Demo School "
            "from app/seed.py locally and in CI, or the synthetic pilot school when deployed.\n\n"
            "Requests marked by allow_writes leave rows behind and are skipped unless the environment "
            "sets allow_writes=true."
        ),
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    "event": [{"listen": "prerequest", "script": {"type": "text/javascript", "exec": [COLLECTION_PREREQUEST]}},
              {"listen": "test","script": {"type": "text/javascript", "exec": COLLECTION_TESTS.splitlines()}}],
    "variable": [{"key": k, "value": ""} for k in (
        "run_id", "admin_id", "school_id", "teacher_id", "teacher_class_ids", "student_id", "student2_id", "class_id",
        "project_id", "version_id", "my_total", "media_project_id", "media_id", "link_id", "source_id", "copy_id",
        "copy_slug", "library_asset_id", "account_id", "pack_slug",
        "ft_students", "ft_educators", "ft_can_adjust", "template_id",
    )],
    "item": [health, auth, me, classes, projects, media, submissions, public, analytics, library, packs, admin,
             permissions],
}


def environment(name: str, values: dict[str, str], secret: tuple[str, ...] = ()) -> dict:
    return {
        "name": name,
        "values": [{"key": k, "value": v, "type": "secret" if k in secret else "default", "enabled": True}
                   for k, v in values.items()],
        "_postman_variable_scope": "environment",
    }


DEV_TOKENS = {"token_admin": "dev|admin", "token_teacher": "dev|teacher", "token_student": "dev|student1",
              "token_student2": "dev|student2"}
TOKENS = tuple(DEV_TOKENS)

ENVIRONMENTS = {
    "local": environment("VectorSpace local", {
        "baseUrl": "http://127.0.0.1:8000", **DEV_TOKENS, "allow_writes": "true",
        "time_budget_ms": "1000", "cold_start_budget_ms": "5000",
    }),
    "ci": environment("VectorSpace CI", {
        "baseUrl": "http://127.0.0.1:8000", **DEV_TOKENS, "allow_writes": "true",
        "time_budget_ms": "2000", "cold_start_budget_ms": "10000",
    }),
    # tokens empty: fill them as Postman current values, or pass --env-var to newman. Never commit them.
    "deployed": environment("VectorSpace deployed (Render)", {
        "baseUrl": "https://vectorspace-api-bcsx.onrender.com", **{k: "" for k in TOKENS}, "allow_writes": "false",
        "time_budget_ms": "3000", "cold_start_budget_ms": "90000",
    }, secret=TOKENS),
}


def main() -> None:
    def write(name: str, data: dict) -> None:
        (HERE / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    write("vectorspace.postman_collection.json", COLLECTION)
    for key, env in ENVIRONMENTS.items():
        write(f"{key}.postman_environment.json", env)
    count = sum(len(f["item"]) for f in COLLECTION["item"])
    examples = sum(1 for f in COLLECTION["item"] for i in f["item"] if i["response"])
    print(f"{count} requests in {len(COLLECTION['item'])} folders, {examples} with a recorded example")


if __name__ == "__main__":
    main()
