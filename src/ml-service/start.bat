@echo off
echo ========================================
echo  Sentinel-Health ML Engine Launcher
echo ========================================

:: Detect Python command
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=py
    goto :found
)
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=python
    goto :found
)
where python3 >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set PYTHON_CMD=python3
    goto :found
)

echo [ERROR] Python not found. Please install from https://www.python.org/downloads/
pause
exit /b 1

:found
echo Detected Python: %PYTHON_CMD%

:: Create Virtual Environment if it doesn't exist
if not exist venv (
    echo Creating virtual environment...
    %PYTHON_CMD% -m venv venv
)

:: Use the venv's python
set VENV_PYTHON=venv\Scripts\python.exe

echo.
echo Installing / verifying dependencies in virtual environment...
%VENV_PYTHON% -m pip install --quiet -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)

echo.
echo Starting Sentinel-Health ML Engine on http://localhost:8005 ...
echo Press Ctrl+C to stop.
echo.
%VENV_PYTHON% -m uvicorn main:app --host 0.0.0.0 --port 8005 --reload
