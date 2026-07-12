# -*- coding: utf-8 -*-
"""
build_context.py — Gerador determinístico de contexto do sistema Seguro Clínicas.

Descobre todos os repositórios Git na pasta raiz, inventaria TODOS os arquivos,
classifica cada um (conteúdo integral / somente metadados / excluído com
justificativa), protege segredos, gera XMLs consolidados/particionados com o
conteúdo integral dos arquivos textuais relevantes, produz inventários CSV e
um relatório de auditoria com reconciliação matemática.

Uso:
    py _seguro_clinicas_context/tools/build_context.py

Saídas (todas dentro de _seguro_clinicas_context/):
    xml/00-seguro-clinicas-master-index.xml
    xml/NN-<repo>-parte-XXX.xml
    xml/seguro-clinicas-completo.xml           (somente se couber no limite)
    inventory/*.csv
    inventory/audit-report.md
    security/potential_secrets_report.md

Não modifica nenhum arquivo dos repositórios.
"""

import csv
import hashlib
import json
import re
import subprocess
import sys
try:  # parser endurecido contra XXE/billion-laughs, se disponível
    import defusedxml.ElementTree as ET
except ImportError:  # fallback: stdlib (XMLs gerados localmente por este script)
    import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

GENERATOR_VERSION = "1.0.0"

ROOT = Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "_seguro_clinicas_context"
XML_DIR = OUT / "xml"
INV_DIR = OUT / "inventory"
SEC_DIR = OUT / "security"

# ---------------------------------------------------------------- parâmetros
MAX_XML_BYTES = 8 * 1024 * 1024      # tamanho alvo máximo de cada parte XML
MAX_TEXT_BYTES = 3 * 1024 * 1024     # arquivo textual maior que isso => metadados
READ_ORDER = [
    "sigo-clinicas-api",
    "sigo-clinicas-painel",
    "sigo-clinicas-www",
    "sigo-clinicas-app",
    "bedin-api",
    "bedin-painel",
    "bedin-www",
]

BINARY_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".bmp", ".tiff",
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    ".zip", ".gz", ".tar", ".rar", ".7z", ".jar", ".aar",
    ".pdf", ".psd", ".ai", ".sketch",
    ".mp3", ".mp4", ".wav", ".avi", ".mov", ".webm",
    ".exe", ".dll", ".so", ".dylib", ".bin", ".class",
    ".keystore", ".jks", ".p12", ".pfx", ".der", ".cer",
    ".db", ".sqlite", ".sqlite3", ".realm",
    ".pack", ".idx", ".rev",
    ".pyc", ".pyo", ".o", ".a", ".swf", ".fla",
}

# diretórios cujo conteúdo é dependência instalada / artefato / cache
EXCLUDED_DIR_NAMES = {
    "node_modules", "bower_components", "vendor", ".venv", "venv",
    "__pycache__", ".next", "dist", "build", "coverage", ".dart_tool",
    "Pods", ".gradle", ".pub-cache", ".cache", "tmp",
}
# exceções: diretórios com esses nomes que NÃO são artefato (nenhum caso aqui,
# mas 'build' só é excluído se contiver artefatos; diretórios rastreados pelo
# git nunca são excluídos por nome)
JUNK_FILENAMES = {"thumbs.db", "desktop.ini", ".ds_store"}

# padrões de caminho de bibliotecas de terceiros vendorizadas/minificadas
VENDORED_PATH_PATTERNS = [
    re.compile(r"(^|/)static/antd/", re.I),
]
MINIFIED_PATTERNS = [
    re.compile(r"\.min\.(js|css)$", re.I),
    re.compile(r"\.(js|css)\.map$", re.I),
]

REAL_ENV_RE = re.compile(r"(^|/)\.env(\.[A-Za-z0-9_.-]+)?$")
ENV_TEMPLATE_RE = re.compile(r"\.(example|sample|dist|template)$", re.I)

LANG_BY_EXT = {
    ".php": "PHP", ".js": "JavaScript", ".ts": "TypeScript", ".vue": "Vue",
    ".dart": "Dart", ".html": "HTML", ".htm": "HTML", ".css": "CSS",
    ".scss": "SCSS", ".less": "Less", ".json": "JSON", ".yml": "YAML",
    ".yaml": "YAML", ".xml": "XML", ".md": "Markdown", ".sql": "SQL",
    ".sh": "Shell", ".bat": "Batch", ".ps1": "PowerShell", ".py": "Python",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".rb": "Ruby",
    ".gradle": "Gradle", ".properties": "Properties", ".ini": "INI",
    ".toml": "TOML", ".lock": "Lockfile", ".svg": "SVG", ".txt": "Texto",
    ".dist": "Template", ".conf": "Config", ".twig": "Twig",
    ".phtml": "PHP-Template", ".env": "DotEnv", ".plist": "Plist",
}

# ------------------------------------------------------------ segredos
SECRET_PATTERNS = [
    ("aws-access-key-id", re.compile(r"\b(AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("private-key-block", re.compile(
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
        re.S)),
    ("bcrypt-hash", re.compile(r"\$2[aby]?\$\d{2}\$[A-Za-z0-9./]{53}")),
    ("jwt-token", re.compile(
        r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b")),
    ("url-with-credentials", re.compile(
        r"\b([a-z][a-z0-9+.-]*://[^/\s:@'\"]+):([^@\s'\"]+)@")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    ("keyword-assignment", re.compile(
        r"(?i)\b(password|passwd|pwd|secret|api[_-]?key|apikey|"
        r"client[_-]?secret|access[_-]?token|auth[_-]?token|private[_-]?key|"
        r"encryption[_-]?key)\b['\"]?\s*(=>|=|:)\s*(['\"])([^'\"]{4,})\3")),
    # estilo env/YAML sem aspas: AWS_CREDENTIALS_SECRET: valor / TOKEN=valor
    ("env-style-credential", re.compile(
        r"(?i)\b([A-Z0-9_]*(?:SECRET|PASSWORD|PASSWD|TOKEN|ACCESS_KEY|"
        r"PRIVATE_KEY|CREDENTIALS_KEY|API_KEY)[A-Z0-9_]*)\s*[:=]\s*"
        r"([A-Za-z0-9+/=_.\-]{8,})\s*$")),
    # estilo msmtp/netrc: "password VALOR" separado por espaço
    ("config-word-credential", re.compile(
        r"(?i)\b(password|passwd)\s+([A-Za-z0-9+/=_.\-]{12,})")),
]

# valores que não são segredo real (placeholders comuns)
PLACEHOLDER_VALUES = re.compile(
    r"(?i)^(\[?redacted\]?|changeme|change_me|xxx+|your[_-].*|<.*>|\{\{.*\}\}|"
    r"\$\{.*\}|password|secret|null|true|false|utf-?8|bearer|basic|oauth2?)$")

INVALID_XML_CHARS = re.compile(
    "[^\x09\x0A\x0D\x20-퟿-�]")

# ------------------------------------------------------- extração heurística
ENV_VAR_PATTERNS = [
    ("getenv", re.compile(r"getenv\(\s*['\"]([A-Z0-9_]{2,})['\"]")),
    ("$_SERVER", re.compile(r"\$_SERVER\[\s*['\"]([A-Z0-9_]{2,})['\"]")),
    ("$_ENV", re.compile(r"\$_ENV\[\s*['\"]([A-Z0-9_]{2,})['\"]")),
    ("process.env", re.compile(r"process\.env\.([A-Z0-9_]{2,})")),
    ("dart-fromEnvironment", re.compile(
        r"fromEnvironment\(\s*['\"]([A-Za-z0-9_]{2,})['\"]")),
]
HTTP_CALL_RE = re.compile(
    r"(?:axios|\$http|http|dio|api)\s*\.\s*"
    r"(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]", re.I)
ROUTE_DEF_RE = re.compile(r"'route'\s*=>\s*'([^']+)'")
URL_RE = re.compile(r"https?://[A-Za-z0-9.-]+(?::\d+)?")
CREATE_TABLE_RE = re.compile(r"CREATE TABLE\s+`?([A-Za-z0-9_]+)`?", re.I)
DOCTRINE_TABLE_RE = re.compile(r"^\s*table:\s*([A-Za-z0-9_]+)", re.M)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run_git(repo: Path, *args) -> str:
    r = subprocess.run(["git", "-C", str(repo), *args],
                       capture_output=True)
    return r.stdout.decode("utf-8", errors="replace").strip()


def xml_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))


def cdata(s: str) -> str:
    s = INVALID_XML_CHARS.sub("", s)
    return "<![CDATA[" + s.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def detect_language(rel: str) -> str:
    p = Path(rel)
    name = p.name.lower()
    if name == "dockerfile":
        return "Dockerfile"
    if name.startswith(".env"):
        return "DotEnv"
    if name == "makefile":
        return "Makefile"
    ext = p.suffix.lower()
    if ext == ".dist":
        inner = Path(p.stem).suffix.lower()
        return LANG_BY_EXT.get(inner, "Template")
    return LANG_BY_EXT.get(ext, ext.lstrip(".") or "sem-extensão")


def guess_purpose(rel: str) -> str:
    r = rel.lower()
    rules = [
        ("/.git/", "interno do Git"),
        ("postman", "coleção Postman (contrato de API)"),
        ("migration", "migration de banco de dados"),
        ("dump.sql", "dump/schema do banco de dados"),
        (".gitlab-ci", "pipeline de CI/CD (GitLab)"),
        ("cloudformation", "infraestrutura como código (AWS CloudFormation)"),
        ("dockerfile", "definição de imagem Docker"),
        ("docker-compose", "orquestração local Docker"),
        ("/entity/", "entidade de domínio (Doctrine)"),
        (".dcm.yml", "mapeamento ORM Doctrine"),
        ("/rest/", "recurso REST (Apigility)"),
        ("/rpc/", "serviço RPC (Apigility)"),
        ("/controller", "controller"),
        ("/listener/", "listener de eventos (auth etc.)"),
        ("/filter/", "filtro/normalização de entrada"),
        ("/repository/", "repositório de dados"),
        ("module.config.php", "configuração de módulo (rotas, DI, REST)"),
        ("/config/autoload/", "configuração global da aplicação"),
        ("composer.json", "manifesto de dependências PHP"),
        ("composer.lock", "lockfile de dependências PHP"),
        ("package.json", "manifesto de dependências JS"),
        ("package-lock.json", "lockfile npm"),
        ("yarn.lock", "lockfile yarn"),
        ("pubspec.yaml", "manifesto de dependências Flutter/Dart"),
        ("pubspec.lock", "lockfile Flutter/Dart"),
        ("/router", "definição de rotas do frontend"),
        ("/store/", "estado global (store)"),
        ("/services/", "serviço/cliente de API"),
        ("/src/service", "serviço/cliente de API"),
        ("/components/", "componente de UI"),
        ("/pages/", "página/tela"),
        ("/views/", "página/tela"),
        ("/layouts/", "layout de UI"),
        ("/lib/", "código-fonte da aplicação"),
        ("readme", "documentação"),
        ("changelog", "histórico de versões"),
        ("/test", "teste"),
        ("phpcs.xml", "configuração de lint (PHP CodeSniffer)"),
        (".eslintrc", "configuração de lint (ESLint)"),
        ("/assets/", "asset estático"),
        ("/static/", "asset estático"),
        ("/public/", "asset público"),
        ("androidmanifest.xml", "manifesto Android"),
        ("info.plist", "configuração iOS"),
        ("build.gradle", "build Android (Gradle)"),
    ]
    for needle, purpose in rules:
        if needle in r:
            return purpose
    return "arquivo do projeto"


def is_binary_content(head: bytes) -> bool:
    return b"\x00" in head


class SecretFinding:
    def __init__(self, repo, rel, line, kind):
        self.repo, self.rel, self.line, self.kind = repo, rel, line, kind


def redact_secrets(text: str, repo: str, rel: str, findings: list) -> str:
    """Substitui possíveis segredos por [REDACTED_SECRET] e registra achados."""

    def note(kind, pos):
        line = text.count("\n", 0, pos) + 1
        findings.append(SecretFinding(repo, rel, line, kind))

    # blocos de chave privada (multilinha) primeiro
    def _block(m):
        note("private-key-block", m.start())
        return "[REDACTED_SECRET]"
    text = SECRET_PATTERNS[1][1].sub(_block, text)

    out = []
    offset = 0
    for lineno, line in enumerate(text.split("\n"), 1):
        newline = line
        for kind, pat in SECRET_PATTERNS:
            if kind == "private-key-block":
                continue
            def _sub(m, kind=kind, lineno=lineno):
                if kind == "keyword-assignment":
                    val = m.group(4)
                    if PLACEHOLDER_VALUES.match(val) or len(val) < 4:
                        return m.group(0)
                    findings.append(SecretFinding(repo, rel, lineno, kind))
                    return (m.group(1) + " " + m.group(2) + " " + m.group(3)
                            + "[REDACTED_SECRET]" + m.group(3))
                if kind in ("env-style-credential", "config-word-credential"):
                    val = m.group(2)
                    if PLACEHOLDER_VALUES.match(val):
                        return m.group(0)
                    findings.append(SecretFinding(repo, rel, lineno, kind))
                    return m.group(0).replace(val, "[REDACTED_SECRET]")
                if kind == "url-with-credentials":
                    findings.append(SecretFinding(repo, rel, lineno, kind))
                    return m.group(1) + ":[REDACTED_SECRET]@"
                findings.append(SecretFinding(repo, rel, lineno, kind))
                return "[REDACTED_SECRET]"
            newline = pat.sub(_sub, newline)
        out.append(newline)
        offset += len(line) + 1
    return "\n".join(out)


def redact_env_file(text: str, repo: str, rel: str, findings: list) -> str:
    """Para .env reais: mantém apenas nomes de variáveis."""
    out = []
    for lineno, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            out.append(line)
            continue
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=", stripped)
        if m:
            findings.append(SecretFinding(repo, rel, lineno, "dotenv-value"))
            out.append(f"{m.group(1)}=[REDACTED]")
        else:
            out.append("[REDACTED_LINE]")
    return "\n".join(out)


class FileRecord:
    __slots__ = ("repo", "rel", "abspath", "size", "sha", "ext", "language",
                 "git_status", "decision", "reason", "purpose", "content",
                 "redactions")

    def __init__(self, **kw):
        for k in self.__slots__:
            setattr(self, k, kw.get(k))


def classify_and_load(repo_name: str, repo_root: Path, rel: str,
                      abspath: Path, tracked: set, findings: list,
                      collectors: dict) -> FileRecord:
    size = abspath.stat().st_size
    ext = Path(rel).suffix.lower()
    git_status = ("tracked" if rel in tracked
                  else ("git-internal" if rel.startswith(".git/")
                        else "untracked"))
    rec = FileRecord(repo=repo_name, rel=rel, abspath=abspath, size=size,
                     sha=sha256_of(abspath), ext=ext,
                     language=detect_language(rel), git_status=git_status,
                     purpose=guess_purpose(f"/{rel}"), content=None,
                     redactions=0)

    lower = rel.lower()
    parts = set(p.lower() for p in Path(rel).parts)

    # 1. internos do git
    if rel.startswith(".git/"):
        rec.decision, rec.reason = "excluded", \
            "interno do controle de versão Git (histórico/hooks/packs)"
        return rec
    # 2. lixo de SO
    if Path(rel).name.lower() in JUNK_FILENAMES:
        rec.decision, rec.reason = "excluded", "arquivo de sistema operacional"
        return rec
    # 3. diretórios de dependências/artefatos (apenas se NÃO rastreado)
    if git_status != "tracked" and parts & EXCLUDED_DIR_NAMES:
        rec.decision, rec.reason = "excluded", \
            "dependência instalada ou artefato de build (não rastreado)"
        return rec
    # 4. binários por extensão
    if ext in BINARY_EXTS and not rel.endswith(".git/config"):
        rec.decision, rec.reason = "metadata-only", \
            "arquivo binário/não-textual — representado por hash e metadados"
        return rec
    # 5. bibliotecas de terceiros vendorizadas / minificadas / source maps
    if any(p.search(rel) for p in VENDORED_PATH_PATTERNS) or \
       any(p.search(rel) for p in MINIFIED_PATTERNS):
        rec.decision, rec.reason = "metadata-only", \
            ("biblioteca de terceiros vendorizada/minificada ou source map — "
             "conteúdo não autoral e reconstituível")
        return rec

    # carrega bytes
    try:
        raw = abspath.read_bytes()
    except OSError as e:
        rec.decision, rec.reason = "excluded", f"erro de leitura: {e}"
        return rec
    if is_binary_content(raw[:8192]):
        rec.decision, rec.reason = "metadata-only", \
            "conteúdo binário detectado (bytes nulos)"
        return rec
    if size > MAX_TEXT_BYTES:
        rec.decision, rec.reason = "metadata-only", \
            f"arquivo textual excede o limite de {MAX_TEXT_BYTES} bytes"
        return rec

    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("cp1252", errors="replace")

    name = Path(rel).name
    if REAL_ENV_RE.search(rel) and not ENV_TEMPLATE_RE.search(name):
        rec.content = redact_env_file(text, repo_name, rel, findings)
        rec.decision = "full-content"
        rec.reason = ("arquivo .env real — apenas nomes de variáveis "
                      "preservados, valores substituídos por [REDACTED]")
        rec.redactions = rec.content.count("[REDACTED")
        _collect_env_names_from_envfile(rec, collectors)
        return rec

    before = len(findings)
    rec.content = redact_secrets(text, repo_name, rel, findings)
    rec.redactions = len(findings) - before
    rec.decision = "full-content"
    rec.reason = ("conteúdo integral incluído"
                  + (" (com valores sensíveis redigidos)"
                     if rec.redactions else ""))
    _collect_heuristics(repo_name, rel, text, collectors)
    return rec


def _collect_env_names_from_envfile(rec: FileRecord, collectors: dict):
    for line in rec.content.splitlines():
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=\[REDACTED\]", line)
        if m:
            collectors["envvars"].add((m.group(1), rec.repo, rec.rel,
                                       "arquivo .env"))


def _collect_heuristics(repo: str, rel: str, text: str, collectors: dict):
    for mech, pat in ENV_VAR_PATTERNS:
        for m in pat.finditer(text):
            collectors["envvars"].add((m.group(1), repo, rel, mech))
    for m in HTTP_CALL_RE.finditer(text):
        collectors["endpoints"].add(
            (repo, m.group(1).upper(), m.group(2), rel, "chamada-http-cliente"))
    if rel.endswith("module.config.php"):
        for m in ROUTE_DEF_RE.finditer(text):
            collectors["endpoints"].add(
                (repo, "ROUTE", m.group(1), rel, "rota-zf-apigility"))
    if "postman" in rel.lower() and rel.endswith(".json"):
        try:
            data = json.loads(text)
            _walk_postman(data.get("item", []), repo, rel, collectors)
        except (json.JSONDecodeError, AttributeError):
            pass
    for m in URL_RE.finditer(text):
        url = m.group(0)
        if "w3.org" in url or "schema" in url.lower():
            continue
        collectors["domains"].setdefault(repo, {}) \
            .setdefault(url, set()).add(rel)
    if rel.endswith(".sql"):
        for m in CREATE_TABLE_RE.finditer(text):
            collectors["dbobjects"].add(
                (repo, "table", m.group(1), rel, "CREATE TABLE em SQL"))
    if rel.endswith(".dcm.yml"):
        for m in DOCTRINE_TABLE_RE.finditer(text):
            collectors["dbobjects"].add(
                (repo, "table", m.group(1), rel, "mapeamento Doctrine YAML"))
    base = Path(rel).name
    if base == "composer.json":
        _collect_manifest_deps(repo, rel, text, collectors,
                               ("require", "require-dev"), "composer")
    elif base == "package.json":
        _collect_manifest_deps(repo, rel, text, collectors,
                               ("dependencies", "devDependencies"), "npm")
    elif base == "bower.json":
        _collect_manifest_deps(repo, rel, text, collectors,
                               ("dependencies", "devDependencies"), "bower")
    elif base == "pubspec.yaml":
        _collect_pubspec_deps(repo, rel, text, collectors)


def _collect_manifest_deps(repo, rel, text, collectors, sections, manager):
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return
    for section in sections:
        dev = "dev" if "dev" in section.lower() else "prod"
        for name, ver in (data.get(section) or {}).items():
            collectors["deps"].add((repo, manager, name, str(ver), dev, rel))


def _collect_pubspec_deps(repo, rel, text, collectors):
    section = None
    for line in text.splitlines():
        if re.match(r"^dependencies:\s*$", line):
            section = "prod"
            continue
        if re.match(r"^dev_dependencies:\s*$", line):
            section = "dev"
            continue
        if re.match(r"^[A-Za-z_]", line):
            section = None
            continue
        if section:
            m = re.match(r"^  ([A-Za-z0-9_]+):\s*(.*)$", line)
            if m:
                collectors["deps"].add(
                    (repo, "pub", m.group(1), m.group(2).strip() or "(complexa)",
                     section, rel))


def _walk_postman(items, repo, rel, collectors):
    for item in items:
        if not isinstance(item, dict):
            continue
        if "item" in item:
            _walk_postman(item["item"], repo, rel, collectors)
        req = item.get("request")
        if isinstance(req, dict):
            url = req.get("url")
            raw = url.get("raw", "") if isinstance(url, dict) else str(url or "")
            method = req.get("method", "GET")
            if raw:
                collectors["endpoints"].add(
                    (repo, method.upper(), raw, rel, "postman-collection"))


# --------------------------------------------------------------- descoberta
def discover_repos():
    repos = []
    for child in sorted(ROOT.iterdir()):
        if child.is_dir() and (child / ".git").is_dir():
            repos.append(child)
    ordered = [ROOT / n for n in READ_ORDER if (ROOT / n) in repos]
    extra = [r for r in repos if r not in ordered]
    return ordered + extra


def repo_metadata(repo: Path) -> dict:
    return {
        "name": repo.name,
        "relativePath": repo.name,
        "branch": run_git(repo, "rev-parse", "--abbrev-ref", "HEAD"),
        "commit": run_git(repo, "rev-parse", "HEAD"),
        "remote": run_git(repo, "remote", "get-url", "origin"),
        "lastCommitDate": run_git(repo, "log", "-1", "--format=%cI"),
        "statusSummary": (run_git(repo, "status", "--porcelain") or
                          "working tree limpo"),
    }


def detect_stack(repo: Path) -> str:
    stacks = []
    if (repo / "composer.json").exists():
        try:
            data = json.loads((repo / "composer.json").read_text("utf-8"))
            req = data.get("require", {})
            fw = [k for k in req if k.startswith(("zendframework", "zfcampus",
                                                  "laminas", "doctrine"))]
            stacks.append("PHP (" + (data.get("require", {}).get("php", "?"))
                          + "); frameworks: " + ", ".join(sorted(fw)[:6]))
        except (json.JSONDecodeError, OSError):
            stacks.append("PHP (composer.json presente)")
    if (repo / "pubspec.yaml").exists():
        stacks.append("Flutter/Dart (pubspec.yaml)")
    if (repo / "package.json").exists():
        try:
            data = json.loads((repo / "package.json").read_text("utf-8"))
            deps = {**data.get("dependencies", {}),
                    **data.get("devDependencies", {})}
            fw = [k for k in ("vue", "react", "next", "nuxt", "@angular/core",
                              "angular", "antd", "element-ui", "gatsby",
                              "umi", "dva") if k in deps]
            stacks.append("Node/JS; frameworks: " + ", ".join(fw))
        except (json.JSONDecodeError, OSError):
            stacks.append("Node/JS (package.json presente)")
    return " | ".join(stacks) or "não detectado automaticamente"


def detect_commands(repo: Path) -> list:
    cmds = []
    pj = repo / "package.json"
    if pj.exists():
        try:
            for k, v in (json.loads(pj.read_text("utf-8"))
                         .get("scripts", {}) or {}).items():
                cmds.append(f"npm run {k}  →  {v}")
        except (json.JSONDecodeError, OSError):
            pass
    cj = repo / "composer.json"
    if cj.exists():
        try:
            for k in (json.loads(cj.read_text("utf-8"))
                      .get("scripts", {}) or {}):
                cmds.append(f"composer {k}")
        except (json.JSONDecodeError, OSError):
            pass
    if (repo / "pubspec.yaml").exists():
        cmds += ["flutter pub get", "flutter run", "flutter build apk|ios"]
    if (repo / "docker-compose.yml").exists():
        cmds.append("docker-compose up")
    if (repo / ".gitlab-ci.yml").exists():
        cmds.append("(CI) ver .gitlab-ci.yml")
    return cmds


def detect_entrypoints(repo: Path) -> list:
    candidates = ["public/index.php", "lib/main.dart", "src/main.js",
                  "src/index.js", "src/main.ts", "index.html",
                  "public/index.html", "src/App.vue", "config/application.config.php"]
    return [c for c in candidates if (repo / c).exists()]


def walk_repo_files(repo: Path):
    """Todos os arquivos do repositório, incluindo .git, ordenados."""
    files = []
    for p in sorted(repo.rglob("*")):
        if p.is_file() and not p.is_symlink():
            rel = p.relative_to(repo).as_posix()
            files.append((rel, p))
    return files


# ------------------------------------------------------------------- geração
def main():
    started = datetime.now(timezone.utc).isoformat()
    for d in (XML_DIR, INV_DIR, SEC_DIR):
        d.mkdir(parents=True, exist_ok=True)

    repos = discover_repos()
    if not repos:
        print("Nenhum repositório encontrado.", file=sys.stderr)
        sys.exit(1)

    findings = []
    collectors = {"envvars": set(), "endpoints": set(), "domains": {},
                  "deps": set(), "dbobjects": set()}
    all_records = {}          # repo -> [FileRecord]
    repo_meta = {}
    tracked_sets = {}

    for repo in repos:
        name = repo.name
        print(f"[+] processando {name} ...")
        repo_meta[name] = repo_metadata(repo)
        tracked = set(
            filter(None, run_git(repo, "ls-files", "-z").split("\0")))
        tracked_sets[name] = tracked
        records = []
        for rel, abspath in walk_repo_files(repo):
            records.append(classify_and_load(
                name, repo, rel, abspath, tracked, findings, collectors))
        all_records[name] = records

    # ------------------------------------------------ reconciliação matemática
    total = sum(len(v) for v in all_records.values())
    incl = sum(1 for v in all_records.values()
               for r in v if r.decision == "full-content")
    meta = sum(1 for v in all_records.values()
               for r in v if r.decision == "metadata-only")
    excl = sum(1 for v in all_records.values()
               for r in v if r.decision == "excluded")
    assert total == incl + meta + excl, \
        f"reconciliação falhou: {total} != {incl}+{meta}+{excl}"

    # todo arquivo rastreado deve estar representado
    missing_tracked = {}
    for name, tracked in tracked_sets.items():
        inv_paths = {r.rel for r in all_records[name]}
        miss = sorted(t for t in tracked if t not in inv_paths)
        if miss:
            missing_tracked[name] = miss
    if missing_tracked:
        print("ERRO: arquivos rastreados fora do inventário:",
              missing_tracked, file=sys.stderr)
        sys.exit(2)

    # ------------------------------------------------------------- CSVs
    write_csvs(all_records, repo_meta, collectors, findings)

    # ------------------------------------------------------------- XMLs
    parts_index = generate_repo_xmls(all_records, repo_meta, collectors)
    master = generate_master_index(parts_index, repo_meta, started,
                                   total, incl, meta, excl)
    consolidated = maybe_generate_consolidated(parts_index)

    # ------------------------------------------------------------ validação
    xml_files = [XML_DIR / p["file"] for p in parts_index] + [master]
    if consolidated:
        xml_files.append(consolidated)
    validation = []
    for xf in xml_files:
        try:
            ET.parse(xf)
            validation.append((xf.name, "OK", ""))
        except ET.ParseError as e:
            validation.append((xf.name, "ERRO", str(e)))

    # ------------------------------------------------------- relatórios
    write_secrets_report(findings)
    write_audit_report(started, repos, repo_meta, all_records, tracked_sets,
                       total, incl, meta, excl, parts_index, validation,
                       consolidated, findings)

    errors = [v for v in validation if v[1] != "OK"]
    print(f"\nDescobertos: {total} | integral: {incl} | metadados: {meta} "
          f"| excluídos: {excl}")
    print(f"XMLs gerados: {len(xml_files)} | inválidos: {len(errors)}")
    print(f"Possíveis segredos: {len(findings)}")
    if errors:
        for e in errors:
            print("  XML inválido:", e, file=sys.stderr)
        sys.exit(3)
    print("Geração concluída com sucesso.")


def write_csvs(all_records, repo_meta, collectors, findings):
    def w(name, header, rows):
        with open(INV_DIR / name, "w", newline="", encoding="utf-8-sig") as f:
            cw = csv.writer(f)
            cw.writerow(header)
            cw.writerows(rows)

    header = ["repositorio", "caminho", "extensao", "tamanho_bytes", "sha256",
              "status_git", "classificacao", "decisao", "justificativa"]
    rows_all, rows_inc, rows_meta, rows_exc = [], [], [], []
    for name, records in all_records.items():
        for r in records:
            row = [r.repo, r.rel, r.ext, r.size, r.sha, r.git_status,
                   r.language, r.decision, r.reason]
            rows_all.append(row)
            {"full-content": rows_inc, "metadata-only": rows_meta,
             "excluded": rows_exc}[r.decision].append(row)
    w("all-files.csv", header, rows_all)
    w("included-files.csv", header, rows_inc)
    w("metadata-only-files.csv", header, rows_meta)
    w("excluded-files.csv", header, rows_exc)

    w("repositories.csv",
      ["nome", "caminho", "branch", "commit", "remote", "ultimo_commit",
       "status", "stack", "arquivos_total"],
      [[m["name"], m["relativePath"], m["branch"], m["commit"], m["remote"],
        m["lastCommitDate"], m["statusSummary"],
        detect_stack(ROOT / m["name"]), len(all_records[m["name"]])]
       for m in repo_meta.values()])

    w("environment-variables.csv",
      ["variavel", "repositorio", "arquivo", "mecanismo"],
      sorted(collectors["envvars"]))

    w("dependencies.csv",
      ["repositorio", "gerenciador", "pacote", "versao", "escopo", "arquivo"],
      sorted(collectors["deps"]))

    w("endpoints.csv",
      ["repositorio", "metodo", "rota_ou_url", "arquivo_fonte", "origem"],
      sorted(collectors["endpoints"]))

    w("database-objects.csv",
      ["repositorio", "tipo", "nome", "arquivo_fonte", "origem"],
      sorted(collectors["dbobjects"]))


def repo_header_xml(meta, repo_path, collectors, records):
    excluded = {}
    for r in records:
        if r.decision == "excluded":
            excluded.setdefault(r.reason, []).append(r.rel)
    domains = collectors["domains"].get(meta["name"], {})
    top_domains = sorted({URL_RE.match(u).group(0) for u in domains})[:40]
    lines = []
    lines.append("  <identity>")
    for tag, key in (("name", "name"), ("relativePath", "relativePath"),
                     ("currentBranch", "branch"), ("currentCommit", "commit"),
                     ("remoteUrl", "remote"),
                     ("lastCommitDate", "lastCommitDate"),
                     ("gitStatus", "statusSummary")):
        lines.append(f"    <{tag}>{xml_escape(meta[key])}</{tag}>")
    lines.append("  </identity>")
    lines.append(f"  <detectedStack>{xml_escape(detect_stack(repo_path))}"
                 f"</detectedStack>")
    lines.append("  <responsibilities>ver docs/02-mapa-de-repositorios.md"
                 "</responsibilities>")
    lines.append("  <entryPoints>")
    for e in detect_entrypoints(repo_path):
        lines.append(f"    <entryPoint>{xml_escape(e)}</entryPoint>")
    lines.append("  </entryPoints>")
    lines.append("  <commands>")
    for c in detect_commands(repo_path):
        lines.append(f"    <command>{xml_escape(c)}</command>")
    lines.append("  </commands>")
    lines.append("  <integrations>")
    for d in top_domains:
        lines.append(f"    <detectedUrl>{xml_escape(d)}</detectedUrl>")
    lines.append("  </integrations>")
    lines.append("  <excludedFiles>")
    for reason, paths in sorted(excluded.items()):
        lines.append(f'    <group reason="{xml_escape(reason)}" '
                     f'count="{len(paths)}">')
        for p in paths:
            lines.append(f"      <path>{xml_escape(p)}</path>")
        lines.append("    </group>")
    lines.append("  </excludedFiles>")
    return "\n".join(lines)


def file_xml(r: FileRecord) -> str:
    lines = ["    <file>"]
    lines.append(f"      <path>{xml_escape(r.repo + '/' + r.rel)}</path>")
    lines.append(f"      <extension>{xml_escape(r.ext)}</extension>")
    lines.append(f"      <language>{xml_escape(r.language)}</language>")
    lines.append(f"      <sizeBytes>{r.size}</sizeBytes>")
    lines.append(f"      <sha256>{r.sha}</sha256>")
    lines.append(f"      <gitStatus>{r.git_status}</gitStatus>")
    lines.append(f"      <inclusionStatus>{r.decision}</inclusionStatus>")
    lines.append(f"      <purpose>{xml_escape(r.purpose)}</purpose>")
    if r.redactions:
        lines.append(f"      <redactedValues>{r.redactions}</redactedValues>")
    if r.decision == "metadata-only":
        lines.append(f"      <exclusionReason>{xml_escape(r.reason)}"
                     f"</exclusionReason>")
    if r.content is not None:
        lines.append("      <content>" + cdata(r.content) + "</content>")
    lines.append("    </file>")
    return "\n".join(lines)


def generate_repo_xmls(all_records, repo_meta, collectors):
    parts_index = []
    for idx, (name, records) in enumerate(all_records.items(), start=1):
        meta = repo_meta[name]
        included = [r for r in records
                    if r.decision in ("full-content", "metadata-only")]
        header = repo_header_xml(meta, ROOT / name, collectors, records)
        part_no = 1
        buf, buf_files, first_file = [], 0, None
        header_block = (f'<repositoryPart repository="{xml_escape(name)}" ')

        def flush(last_file):
            nonlocal part_no, buf, buf_files, first_file
            fname = f"{idx:02d}-{name}-parte-{part_no:03d}.xml"
            body = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                f'<repositoryPart repository="{xml_escape(name)}" '
                f'part="{part_no}" generatorVersion="{GENERATOR_VERSION}">\n'
                + (header + "\n" if part_no == 1 else "")
                + "  <files>\n" + "\n".join(buf) + "\n  </files>\n"
                + "</repositoryPart>\n")
            data = body.encode("utf-8")
            (XML_DIR / fname).write_bytes(data)
            parts_index.append({
                "file": fname, "repo": name, "part": part_no,
                "files": buf_files, "firstFile": first_file,
                "lastFile": last_file, "sizeBytes": len(data),
                "sha256": sha256_bytes(data),
            })
            part_no += 1
            buf, buf_files, first_file = [], 0, None

        current_size = len(header)
        last = None
        for r in included:
            chunk = file_xml(r)
            if buf and current_size + len(chunk) > MAX_XML_BYTES:
                flush(last)
                current_size = 0
            if first_file is None:
                first_file = r.rel
            buf.append(chunk)
            buf_files += 1
            current_size += len(chunk)
            last = r.rel
        if buf or part_no == 1:
            flush(last)
    return parts_index


def generate_master_index(parts_index, repo_meta, started,
                          total, incl, meta_count, excl):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>']
    lines.append(f'<seguroClinicasMasterIndex version="1.0" '
                 f'generatorVersion="{GENERATOR_VERSION}">')
    lines.append("  <generation>")
    lines.append(f"    <generatedAt>{started}</generatedAt>")
    lines.append(f"    <rootDirectory>{xml_escape(str(ROOT))}</rootDirectory>")
    lines.append(f"    <totalRepositories>{len(repo_meta)}</totalRepositories>")
    lines.append(f"    <totalFilesDiscovered>{total}</totalFilesDiscovered>")
    lines.append(f"    <totalFilesIncluded>{incl}</totalFilesIncluded>")
    lines.append(f"    <totalFilesMetadataOnly>{meta_count}"
                 f"</totalFilesMetadataOnly>")
    lines.append(f"    <totalFilesExcluded>{excl}</totalFilesExcluded>")
    lines.append("  </generation>")
    lines.append("  <systemOverview>")
    lines.append("    <description>Seguro Clínicas (produto 'Sigo Clínicas'): "
                 "sistema de gestão para clínicas — API PHP (Zend/Apigility + "
                 "Doctrine + OAuth2), painel administrativo web, site público "
                 "e aplicativo Flutter. A família 'bedin' é uma duplicação/"
                 "white-label dos mesmos repositórios. Ver docs/01-visao-geral"
                 "-do-sistema.md.</description>")
    lines.append("    <architecturalStyle>API REST central + múltiplos "
                 "frontends</architecturalStyle>")
    lines.append("    <mainTechnologies>PHP/Zend-Apigility, Doctrine ORM, "
                 "MySQL, OAuth2, AWS (CloudFormation, ECS, S3, SES, RDS, "
                 "CloudFront), Flutter, JavaScript (React/Next.js). "
                 "NÃO há AWS SNS/SQS nem push notifications no código."
                 "</mainTechnologies>")
    lines.append("  </systemOverview>")
    lines.append("  <readingOrder>")
    lines.append("    <step order=\"0\">Ler docs/00-leia-primeiro.md e este "
                 "índice</step>")
    for i, name in enumerate(repo_meta, start=1):
        lines.append(f'    <step order="{i}">Ler as partes XML de '
                     f'{xml_escape(name)}</step>')
    lines.append("  </readingOrder>")
    lines.append("  <xmlParts>")
    for p in parts_index:
        lines.append("    <xmlPart>")
        lines.append(f"      <fileName>{xml_escape(p['file'])}</fileName>")
        lines.append(f"      <repository>{xml_escape(p['repo'])}</repository>")
        lines.append(f"      <partNumber>{p['part']}</partNumber>")
        lines.append(f"      <fileCount>{p['files']}</fileCount>")
        lines.append(f"      <firstFile>{xml_escape(p['firstFile'] or '')}"
                     f"</firstFile>")
        lines.append(f"      <lastFile>{xml_escape(p['lastFile'] or '')}"
                     f"</lastFile>")
        lines.append(f"      <sizeBytes>{p['sizeBytes']}</sizeBytes>")
        lines.append(f"      <sha256>{p['sha256']}</sha256>")
        lines.append("      <dependsOn>00-seguro-clinicas-master-index.xml"
                     "</dependsOn>")
        lines.append("    </xmlPart>")
    lines.append("  </xmlParts>")
    lines.append("  <repositoryRelations>")
    rel_data = [
        ("sigo-clinicas-painel", "sigo-clinicas-api",
         "consome API REST (OAuth2)", "confirmada"),
        ("sigo-clinicas-www", "sigo-clinicas-api",
         "consome API REST", "confirmada"),
        ("sigo-clinicas-app", "sigo-clinicas-api",
         "NÃO integra a API real — aponta para jsonplaceholder.typicode.com "
         "(boilerplate/demo, login falso)", "refutada"),
        ("bedin-api", "sigo-clinicas-api",
         "mesmo commit — repositório espelho/white-label", "confirmada"),
        ("bedin-painel", "sigo-clinicas-painel",
         "mesmo commit — repositório espelho/white-label", "confirmada"),
        ("bedin-www", "sigo-clinicas-www",
         "mesma base, commits divergentes", "confirmada"),
        ("bedin-painel", "bedin-api", "consome API REST (OAuth2)", "inferida"),
        ("bedin-www", "bedin-api", "consome API REST", "inferida"),
    ]
    for src, dst, mech, conf in rel_data:
        lines.append(f'    <relation confidence="{conf}">')
        lines.append(f"      <source>{src}</source>")
        lines.append(f"      <target>{dst}</target>")
        lines.append(f"      <mechanism>{xml_escape(mech)}</mechanism>")
        lines.append("    </relation>")
    lines.append("  </repositoryRelations>")
    lines.append("  <usageInstructions>Envie primeiro este índice ao Claude "
                 "Chat, depois as partes XML na ordem de leitura. Cada parte "
                 "é autossuficiente e identifica seu repositório. Os caminhos "
                 "dentro de &lt;path&gt; são relativos à raiz do Seguro "
                 "Clínicas (repositorio/caminho). Conteúdos sensíveis foram "
                 "substituídos por [REDACTED_SECRET]/[REDACTED]. Consulte "
                 "inventory/audit-report.md para a auditoria completa."
                 "</usageInstructions>")
    lines.append("</seguroClinicasMasterIndex>")
    data = "\n".join(lines).encode("utf-8")
    out = XML_DIR / "00-seguro-clinicas-master-index.xml"
    out.write_bytes(data)
    return out


def maybe_generate_consolidated(parts_index):
    total = sum(p["sizeBytes"] for p in parts_index)
    if total > MAX_XML_BYTES:
        print(f"[i] consolidado único NÃO gerado: soma das partes "
              f"({total} bytes) excede o limite de {MAX_XML_BYTES} bytes; "
              f"conteúdo preservado nas partes numeradas.")
        return None
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<seguroClinicasContext version="1.0">']
    for p in parts_index:
        body = (XML_DIR / p["file"]).read_text("utf-8")
        body = body.split("\n", 1)[1]  # remove declaração XML
        lines.append(body)
    lines.append("</seguroClinicasContext>")
    out = XML_DIR / "seguro-clinicas-completo.xml"
    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def write_secrets_report(findings):
    lines = ["# Relatório de possíveis segredos detectados",
             "",
             f"Total de ocorrências redigidas: **{len(findings)}**",
             "",
             "Os valores NÃO são reproduzidos aqui nem nos XMLs — foram "
             "substituídos por `[REDACTED_SECRET]`/`[REDACTED]`. Os arquivos "
             "originais dos repositórios não foram modificados.",
             "",
             "| Repositório | Arquivo | Linha | Tipo |",
             "|---|---|---|---|"]
    for f in sorted(findings, key=lambda x: (x.repo, x.rel, x.line)):
        lines.append(f"| {f.repo} | {f.rel} | {f.line} | {f.kind} |")
    (SEC_DIR / "potential_secrets_report.md").write_text(
        "\n".join(lines), encoding="utf-8")


def write_audit_report(started, repos, repo_meta, all_records, tracked_sets,
                       total, incl, meta_count, excl, parts_index,
                       validation, consolidated, findings):
    lines = ["# Relatório de auditoria da geração de contexto", ""]
    lines.append(f"- Gerado em: {started}")
    lines.append(f"- Gerador: build_context.py v{GENERATOR_VERSION}")
    lines.append(f"- Raiz: `{ROOT}`")
    lines.append("")
    lines.append("## Reconciliação matemática")
    lines.append("")
    lines.append(f"`{total} descobertos = {incl} integrais + {meta_count} "
                 f"somente-metadados + {excl} excluídos` → "
                 f"**{'OK' if total == incl + meta_count + excl else 'FALHOU'}**")
    lines.append("")
    lines.append("## Totais por repositório")
    lines.append("")
    lines.append("| Repositório | Descobertos | Integral | Metadados | "
                 "Excluídos | Rastreados (git) | Rastreados representados |")
    lines.append("|---|---|---|---|---|---|---|")
    for name, records in all_records.items():
        i = sum(1 for r in records if r.decision == "full-content")
        m = sum(1 for r in records if r.decision == "metadata-only")
        e = sum(1 for r in records if r.decision == "excluded")
        tr = len(tracked_sets[name])
        inv = {r.rel for r in records}
        rep = sum(1 for t in tracked_sets[name] if t in inv)
        lines.append(f"| {name} | {len(records)} | {i} | {m} | {e} | {tr} "
                     f"| {rep} |")
    lines.append("")
    lines.append("## Arquivos rastreados não representados")
    lines.append("")
    missing_any = False
    for name, tracked in tracked_sets.items():
        inv = {r.rel for r in all_records[name]}
        miss = sorted(t for t in tracked if t not in inv)
        if miss:
            missing_any = True
            lines.append(f"- **{name}**: {miss}")
    if not missing_any:
        lines.append("Nenhum. Todos os arquivos rastreados por git estão "
                     "representados no inventário.")
    lines.append("")
    lines.append("## Validação dos XMLs")
    lines.append("")
    lines.append("| XML | Resultado | Erro |")
    lines.append("|---|---|---|")
    for name, status, err in validation:
        lines.append(f"| {name} | {status} | {err} |")
    lines.append("")
    lines.append("## XML consolidado único")
    lines.append("")
    if consolidated:
        lines.append(f"Gerado: `{consolidated.name}`.")
    else:
        totalb = sum(p["sizeBytes"] for p in parts_index)
        lines.append(f"Não gerado: a soma das partes ({totalb:,} bytes) excede "
                     f"o limite configurado de {MAX_XML_BYTES:,} bytes por "
                     f"arquivo. O conteúdo integral está preservado nas "
                     f"partes numeradas — nada foi resumido ou omitido.")
    lines.append("")
    lines.append("## Possíveis repositórios duplicados")
    lines.append("")
    by_commit = {}
    for m in repo_meta.values():
        by_commit.setdefault(m["commit"], []).append(m["name"])
    for commit, names in by_commit.items():
        if len(names) > 1:
            lines.append(f"- Commit `{commit[:12]}` compartilhado por: "
                         f"{', '.join(names)} → **duplicação confirmada**")
    lines.append("")
    lines.append("## Arquivos grandes (> 1 MB)")
    lines.append("")
    big = [(r.repo, r.rel, r.size, r.decision)
           for v in all_records.values() for r in v
           if r.size > 1_000_000 and not r.rel.startswith(".git/")]
    if big:
        lines.append("| Repositório | Arquivo | Bytes | Decisão |")
        lines.append("|---|---|---|---|")
        for repo, rel, size, dec in sorted(big, key=lambda x: -x[2]):
            lines.append(f"| {repo} | {rel} | {size:,} | {dec} |")
    else:
        lines.append("Nenhum fora de .git/.")
    lines.append("")
    lines.append("## Arquivos representados apenas por metadados")
    lines.append("")
    lines.append(f"Total: {meta_count}. Lista completa em "
                 f"`inventory/metadata-only-files.csv`.")
    lines.append("")
    lines.append("## Possíveis segredos")
    lines.append("")
    lines.append(f"{len(findings)} ocorrências redigidas — ver "
                 f"`security/potential_secrets_report.md`.")
    lines.append("")
    lines.append("## Duplicação de arquivos entre repositórios")
    lines.append("")
    sha_map = {}
    for v in all_records.values():
        for r in v:
            if r.rel.startswith(".git/"):
                continue
            sha_map.setdefault(r.sha, set()).add(r.repo)
    pairs = {}
    for sha, repos_set in sha_map.items():
        if len(repos_set) > 1:
            key = tuple(sorted(repos_set))
            pairs[key] = pairs.get(key, 0) + 1
    for key, count in sorted(pairs.items(), key=lambda x: -x[1]):
        lines.append(f"- {count} arquivos idênticos compartilhados entre: "
                     f"{', '.join(key)}")
    lines.append("")
    lines.append("## Nível de confiança da geração")
    lines.append("")
    lines.append("Alto: reconciliação matemática verificada por assert, "
                 "todos os arquivos rastreados representados, XMLs validados "
                 "por parser. Limitações: extração de endpoints/variáveis é "
                 "heurística (regex); detecção de segredos é heurística e "
                 "pode ter falsos positivos/negativos.")
    (INV_DIR / "audit-report.md").write_text("\n".join(lines),
                                             encoding="utf-8")


if __name__ == "__main__":
    main()
