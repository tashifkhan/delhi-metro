import asyncio

from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.analytics import AnalyticsMiddleware, _headers_from_env, identify


def test_client_param_wins_over_origin():
    assert identify("client=My Portfolio!", {"origin": "https://example.com"}) == (
        "client:my-portfolio",
        "my-portfolio",
        "Named clients",
    )


def test_origin_then_referer():
    assert identify("", {"origin": "https://www.example.com"})[0] == "site:example.com"
    assert identify("", {"referer": "https://foo.github.io/page?x=1"})[0] == "site:foo.github.io"


def test_own_and_local_sites_are_grouped():
    assert identify("", {"origin": "https://ncr-metro.tashif.codes"})[2] == "Own sites"
    assert identify("", {"origin": "https://blr-metro.vercel.app"})[2] == "Own sites"
    assert identify("", {"referer": "https://blr-metro-a0wzvp3n4-tashifkhans-projects.vercel.app/"})[2] == "Own sites"
    assert identify("", {"referer": "http://localhost:8081/"})[0] == "local"


def test_named_user_agents_become_clients():
    ua = "disha-data-pipeline/0.1 (transit dataset builder)"
    assert identify("", {"user-agent": ua})[:2] == ("client:disha-data-pipeline", "disha-data-pipeline")
    assert identify("", {"user-agent": "ncr-metro-map-builder"})[0] == "client:ncr-metro-map-builder"


def test_anonymous_callers_grouped_by_agent():
    assert identify("", {"user-agent": "python-requests/2.32.3"})[0] == "anon:python-requests"
    assert identify("", {"user-agent": "okhttp/4.12.0"})[0] == "anon:okhttp"
    assert identify("", {"user-agent": "curl/8.7.1"})[0] == "anon:curl"
    assert identify("", {"user-agent": "Mozilla/5.0 (X11; Linux x86_64)"})[0] == "anon:browser"
    assert identify("", {})[0] == "anon:unknown"


def test_otlp_headers_env_parsing():
    assert _headers_from_env("x-honeycomb-team=abc,x-other=a%20b") == {"x-honeycomb-team": "abc", "x-other": "a b"}
    assert _headers_from_env("") == {}


def _app(monkeypatch, endpoint="https://otlp.example", fail=False):
    for var in ("OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT"):
        monkeypatch.delenv(var, raising=False)
    if endpoint:
        monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint)
    sent = []

    async def fake_send(self, payload):
        await asyncio.sleep(0)
        if fail:
            raise RuntimeError("backend down")
        sent.append((self.url, payload))

    monkeypatch.setattr(AnalyticsMiddleware, "_send", fake_send)
    app = FastAPI()
    app.add_middleware(AnalyticsMiddleware, api="test-metro")

    @app.get("/api/v1/stations/{code}")
    def station(code: str):
        return {"code": code}

    return app, sent


def _span(payload):
    rs = payload["resourceSpans"][0]
    resource = {a["key"]: list(a["value"].values())[0] for a in rs["resource"]["attributes"]}
    span = rs["scopeSpans"][0]["spans"][0]
    attrs = {a["key"]: list(a["value"].values())[0] for a in span["attributes"]}
    return resource, span, attrs


def test_one_span_per_request_named_by_route(monkeypatch):
    app, sent = _app(monkeypatch)
    with TestClient(app) as client:
        r = client.get("/api/v1/stations/RCK?client=demo", headers={"origin": "https://example.com"})
        assert r.status_code == 200
    assert len(sent) == 1
    url, payload = sent[0]
    assert url == "https://otlp.example/v1/traces"
    resource, span, attrs = _span(payload)
    assert resource["service.name"] == "test-metro-api"
    assert span["name"] == "GET /api/v1/stations/{code}"
    assert attrs["endpoint"] == "/api/v1/stations/{code}"
    assert attrs["url.path"] == "/api/v1/stations/RCK"
    assert attrs["consumer"] == "client:demo"
    assert attrs["http.response.status_code"] == "200"
    assert attrs["origin_host"] == "example.com"


def test_unmatched_paths_are_grouped(monkeypatch):
    app, sent = _app(monkeypatch)
    with TestClient(app) as client:
        assert client.get("/.env").status_code == 404
    _, span, attrs = _span(sent[0][1])
    assert attrs["endpoint"] == "unmatched"
    assert attrs["http.response.status_code"] == "404"
    assert span["status"]["code"] == 0


def test_no_endpoint_sends_nothing(monkeypatch):
    app, sent = _app(monkeypatch, endpoint="")
    with TestClient(app) as client:
        assert client.get("/api/v1/stations/RCK").status_code == 200
    assert sent == []


def test_backend_failure_never_breaks_requests(monkeypatch):
    app, _ = _app(monkeypatch, fail=True)
    with TestClient(app) as client:
        assert client.get("/api/v1/stations/RCK").status_code == 200


def test_wait_mode_sends_before_returning(monkeypatch):
    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://otlp.example")
    sent = []

    async def fake_send_now(self, payload):
        sent.append(payload)

    monkeypatch.setattr(AnalyticsMiddleware, "_send_now", fake_send_now)
    app = FastAPI()
    app.add_middleware(AnalyticsMiddleware, api="test-metro", wait=True)

    @app.get("/api/v1/health")
    def health():
        return {"ok": True}

    with TestClient(app) as client:
        assert client.get("/api/v1/health").status_code == 200
        assert len(sent) == 1  # already sent, not left to a background task
