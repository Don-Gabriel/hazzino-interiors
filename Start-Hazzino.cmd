@echo off
cd /d "%~dp0"
echo Starting Hazzino Studio at http://127.0.0.1:5173
call npm.cmd run dev
pause
