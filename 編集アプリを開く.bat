@echo off
cd /d "%~dp0"
start "YUTORI Editor Server" "C:\Users\Unknown\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\editor-server.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5190/"
