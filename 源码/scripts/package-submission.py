"""生成清洁提交 ZIP，不含依赖、Git、环境凭据；保留队友的实际服务端源码。"""
from pathlib import Path
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "交付包"
OUT.mkdir(exist_ok=True)
DEST = OUT / "创意文娱_0xNEXT_此刻.zip"
required = ["README.md", "队伍介绍.md", "开源与AI使用声明.md", "允许后续开源.md", "LICENSE"]
files = [ROOT / name for name in required]
files += [ROOT / name for name in ["协作分工.md", "项目规划.md"] if (ROOT / name).is_file()]
skip_dirs = {"node_modules", ".git", "__pycache__", "coverage", "test-results", ".cache", ".venv", "logs"}
skip_names = {".DS_Store", ".gitkeep"}
allowed_env = {".env.example"}
for folder in ["源码", "docs"]:
    for path in sorted((ROOT / folder).rglob("*")):
        rel = path.relative_to(ROOT)
        if not path.is_file() or path.is_symlink() or any(p in skip_dirs for p in rel.parts):
            continue
        if path.name in skip_names or path.suffix in {".log", ".pem", ".key", ".p12"}:
            continue
        if path.name.startswith(".env") and path.name not in allowed_env:
            continue
        files.append(path)
for path in files:
    if not path.is_file() or (path.name in required and not path.stat().st_size):
        raise SystemExit("缺少必需文件：" + str(path))

# Scan text without logging matched material. This is a limited pattern check.
patterns = [
    re.compile(r"-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{30,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{24,}\b"),
]
text_suffixes = {".md", ".txt", ".json", ".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".py", ".svg"}
for path in files:
    if path.suffix not in text_suffixes:
        continue
    content = path.read_text(encoding="utf-8", errors="replace")
    if any(pattern.search(content) for pattern in patterns):
        raise SystemExit("发现疑似凭据模式，请检查文件（不显示命中内容）：" + str(path.relative_to(ROOT)))

manifest = []
with zipfile.ZipFile(DEST, "w", zipfile.ZIP_DEFLATED, compresslevel=7) as archive:
    for path in files:
        relative = str(path.relative_to(ROOT))
        data = path.read_bytes()
        archive.writestr(relative, data)
        manifest.append({"path": relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    archive.writestr("文件清单.json", json.dumps(manifest, ensure_ascii=False, indent=2))
with zipfile.ZipFile(DEST) as archive:
    if archive.testzip() is not None:
        raise SystemExit("ZIP 校验失败")
print("已生成：" + str(DEST))
print("文件数：" + str(len(manifest)) + "；大小：" + str(round(DEST.stat().st_size / 1024 / 1024, 2)) + " MB；ZIP 完整性通过。")
print("尚需：合并各窗口完整 AI 对话和 B 实际来源，再重新打包；人工上传并确认云盘成功。")
