#!/usr/bin/env python3
"""Lightweight transcript search for Claude Code.

SQLite FTS5 full-text index over past conversation transcripts in
~/.claude/projects/**/*.jsonl. No embeddings, no daemons, no extra deps —
pure Python stdlib. Indexes human prompts + assistant text only (tool output,
thinking, and system noise are skipped to keep the signal high).

Usage:
  python3 rag_lite.py index                 # build / refresh the index
  python3 rag_lite.py search "query" [n]    # search from the CLI
  python3 rag_lite.py stats                 # row / file counts
  python3 rag_lite.py serve                 # run as an MCP stdio server
"""
import os
import sys
import json
import glob
import sqlite3
import re

HOME = os.path.expanduser("~")
PROJ_DIR = os.path.join(HOME, ".claude", "projects")
DB_DIR = os.path.join(HOME, ".claude", "transcript-search")
DB_PATH = os.path.join(DB_DIR, "index.db")


# ---------------------------------------------------------------- storage
def db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        "CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5("
        "text, role UNINDEXED, session UNINDEXED, project UNINDEXED, "
        "branch UNINDEXED, ts UNINDEXED, file UNINDEXED, line UNINDEXED, "
        "tokenize='porter unicode61')"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS files("
        "path TEXT PRIMARY KEY, size INTEGER, mtime REAL, lines INTEGER)"
    )
    return conn


# ---------------------------------------------------------------- parsing
def extract(obj):
    """Return (role, text) for indexable turns, else None.

    Indexes: user string prompts, assistant text blocks.
    Skips: tool_use / tool_result payloads, thinking, and everything else.
    """
    t = obj.get("type")
    if t not in ("user", "assistant"):
        return None
    m = obj.get("message") or {}
    role = m.get("role") or t
    cont = m.get("content")
    parts = []
    if isinstance(cont, str):
        if role != "user":
            return None
        parts.append(cont)
    elif isinstance(cont, list):
        if role != "assistant":
            return None  # list content on a user turn = tool results -> skip
        for b in cont:
            if isinstance(b, dict) and b.get("type") == "text" and b.get("text"):
                parts.append(b["text"])
    text = "\n".join(p for p in parts if p).strip()
    if not text:
        return None
    # Drop local-command / system-reminder wrappers — pure noise for recall.
    if text.startswith("<local-command") or text.startswith("Caveat:"):
        return None
    return role, text[:20000]


# ---------------------------------------------------------------- indexing
def index_file(conn, path):
    st = os.stat(path)
    row = conn.execute(
        "SELECT size, mtime, lines FROM files WHERE path=?", (path,)
    ).fetchone()
    start = 0
    if row:
        size, mtime, lines = row
        if size == st.st_size and mtime == st.st_mtime:
            return 0  # unchanged
        if st.st_size >= size:
            start = lines  # append-only growth: skip already-indexed lines
        else:
            conn.execute("DELETE FROM chunks WHERE file=?", (path,))  # rewritten
    added = 0
    ln = -1
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for ln, line in enumerate(fh):
            if ln < start:
                continue
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            ex = extract(obj)
            if not ex:
                continue
            role, text = ex
            cwd = obj.get("cwd") or ""
            project = os.path.basename(cwd) if cwd else os.path.basename(os.path.dirname(path))
            conn.execute(
                "INSERT INTO chunks(text,role,session,project,branch,ts,file,line) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (text, role, obj.get("sessionId") or os.path.basename(path),
                 project, obj.get("gitBranch") or "", obj.get("timestamp") or "",
                 path, ln),
            )
            added += 1
    conn.execute(
        "INSERT INTO files(path,size,mtime,lines) VALUES(?,?,?,?) "
        "ON CONFLICT(path) DO UPDATE SET size=excluded.size, mtime=excluded.mtime, lines=excluded.lines",
        (path, st.st_size, st.st_mtime, ln + 1),
    )
    return added


def index_all(conn):
    total = 0
    for path in glob.glob(os.path.join(PROJ_DIR, "*", "*.jsonl")):
        try:
            total += index_file(conn, path)
        except Exception:
            pass
    conn.commit()
    return total


# ---------------------------------------------------------------- search
def fts_query(q):
    toks = re.findall(r"[\w']+", q or "")
    toks = [t for t in toks if len(t) > 1 or t.isdigit()]
    if not toks:
        return None
    return " OR ".join('"%s"' % t.replace('"', '""') for t in toks)


def search(conn, query, limit=8, project=None):
    fq = fts_query(query)
    if not fq:
        return []
    sql = ("SELECT snippet(chunks,0,'»','«',' … ',16), role, session, project, "
           "branch, ts, file, line FROM chunks WHERE chunks MATCH ?")
    args = [fq]
    if project:
        sql += " AND project=?"
        args.append(project)
    sql += " ORDER BY bm25(chunks) LIMIT ?"
    args.append(int(limit))
    return conn.execute(sql, args).fetchall()


def get_context(path, line, before=3, after=3):
    lo, hi = max(0, int(line) - before), int(line) + after
    out = []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            for i, l in enumerate(fh):
                if i < lo:
                    continue
                if i > hi:
                    break
                try:
                    o = json.loads(l)
                except Exception:
                    continue
                ex = extract(o)
                if ex:
                    out.append((i, ex[0], ex[1][:1800]))
    except OSError:
        pass
    return out


def fmt_results(rows):
    if not rows:
        return "No matches."
    out = []
    for snip, role, _session, project, branch, ts, path, line in rows:
        date = (ts or "")[:10] or "?"
        br = branch or "-"
        snip = re.sub(r"\s+", " ", snip).strip()
        out.append(f"[{project} · {br} · {date} · {role}]  {path}:{line}\n  {snip}")
    out.append("\nUse get_context(file, line) for the full surrounding turns.")
    return "\n\n".join(out)


def fmt_context(rows):
    if not rows:
        return "No context found at that location."
    return "\n\n".join(f"--- line {i} ({role}) ---\n{text}" for i, role, text in rows)


# ---------------------------------------------------------------- MCP server
TOOLS = [
    {
        "name": "search",
        "description": (
            "Full-text search over past Claude Code conversation transcripts "
            "(human prompts + assistant replies) for this and other projects. "
            "Use when the user references past work ('we talked about', 'remember "
            "when', 'like last time') or you need a prior decision/context."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search terms."},
                "limit": {"type": "integer", "description": "Max results (default 8)."},
                "project": {"type": "string", "description": "Optional: restrict to a project folder name."},
            },
            "required": ["query"],
        },
    },
    {
        "name": "get_context",
        "description": "Return the surrounding conversation turns around a transcript hit (use the file+line from a search result).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "file": {"type": "string"},
                "line": {"type": "integer"},
                "before": {"type": "integer"},
                "after": {"type": "integer"},
            },
            "required": ["file", "line"],
        },
    },
]


def _send(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def _reply(mid, result):
    _send({"jsonrpc": "2.0", "id": mid, "result": result})


def _error(mid, code, message):
    _send({"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}})


def serve():
    conn = db()
    try:
        index_all(conn)
    except Exception:
        pass
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        method = msg.get("method")
        mid = msg.get("id")
        if method == "initialize":
            ver = (msg.get("params") or {}).get("protocolVersion", "2025-06-18")
            _reply(mid, {
                "protocolVersion": ver,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "transcript-search", "version": "1.0.0"},
            })
        elif method in ("notifications/initialized", "notifications/cancelled"):
            continue  # notifications: no response
        elif method == "ping":
            _reply(mid, {})
        elif method == "tools/list":
            _reply(mid, {"tools": TOOLS})
        elif method == "tools/call":
            p = msg.get("params") or {}
            name = p.get("name")
            a = p.get("arguments") or {}
            try:
                if name == "search":
                    index_all(conn)
                    text = fmt_results(search(conn, a.get("query", ""),
                                              a.get("limit", 8), a.get("project")))
                elif name == "get_context":
                    text = fmt_context(get_context(a.get("file", ""), a.get("line", 0),
                                                   a.get("before", 3), a.get("after", 3)))
                else:
                    _error(mid, -32601, "unknown tool: %s" % name)
                    continue
                _reply(mid, {"content": [{"type": "text", "text": text}]})
            except Exception as e:
                _reply(mid, {"content": [{"type": "text", "text": "error: %s" % e}], "isError": True})
        elif mid is not None:
            _error(mid, -32601, "method not found: %s" % method)


# ---------------------------------------------------------------- CLI
def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd == "serve":
        serve()
    elif cmd == "index":
        conn = db()
        n = index_all(conn)
        print("indexed %d new turns" % n)
    elif cmd == "stats":
        conn = db()
        index_all(conn)
        rows = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        files = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
        projs = conn.execute("SELECT project, COUNT(*) FROM chunks GROUP BY project ORDER BY 2 DESC").fetchall()
        print("turns: %d   files: %d" % (rows, files))
        for pr, c in projs:
            print("  %5d  %s" % (c, pr))
    elif cmd == "search":
        conn = db()
        index_all(conn)
        q = sys.argv[2] if len(sys.argv) > 2 else ""
        n = int(sys.argv[3]) if len(sys.argv) > 3 else 8
        print(fmt_results(search(conn, q, n)))
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
