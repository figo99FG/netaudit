# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

backend_dir = os.path.abspath(".")

# Bundle the VC++ runtime DLLs so the exe works on machines that don't have
# Microsoft Visual C++ Redistributable installed (common cause of python3xx.dll errors)
_vc_dlls = []
for _dll in ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"]:
    for _root in [
        r"C:\Windows\System32",
        r"C:\Users\girif\AppData\Local\Programs\Python\Python312",
    ]:
        _path = os.path.join(_root, _dll)
        if os.path.exists(_path):
            _vc_dlls.append((_path, "."))
            break

a = Analysis(
    ["launcher.py"],
    pathex=[backend_dir],
    binaries=_vc_dlls,
    datas=[
        ("agent_bundle/nmap-setup.exe", "agent_bundle"),
        ("main.py",          "."),
        ("models.py",        "."),
        ("db.py",            "."),
        ("config_store.py",  "."),
        ("parser",           "parser"),
        ("rules",            "rules"),
        ("engine",           "engine"),
    ],
    hiddenimports=[
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "fastapi",
        "pydantic",
        "slowapi",
        "supabase",
        "netmiko",
        "nmap",
        "pystray",
        "PIL",
        "PIL.Image",
        "PIL.ImageDraw",
        "anthropic",
        "openai",
        "sqlite3",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,   # onefile: embed everything in the exe
    a.zipfiles,
    a.datas,
    name="NetAudit-Agent",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=os.path.join(os.environ.get("LOCALAPPDATA", r"C:\Users\Public"), "NetAudit"),
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    uac_admin=False,
    icon=None,
)
