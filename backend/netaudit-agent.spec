# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

backend_dir = os.path.abspath(".")

a = Analysis(
    ["launcher.py"],
    pathex=[backend_dir],
    binaries=[],
    datas=[
        ("agent_bundle/nmap-setup.exe", "agent_bundle"),
        ("main.py",        "."),
        ("models.py",      "."),
        ("db.py",          "."),
        ("parser",         "parser"),
        ("rules",          "rules"),
        ("engine",         "engine"),
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
    [],                  # onedir: no binaries/datas in EXE itself
    name="NetAudit-Agent",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    uac_admin=True,
    icon=None,
)

# onedir: all files collected into dist/NetAudit-Agent/ folder
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="NetAudit-Agent",
)
