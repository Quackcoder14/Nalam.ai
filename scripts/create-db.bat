@echo off
echo ====================================================
echo  nalam.ai — MySQL Database Setup
echo ====================================================
echo.
echo This script creates the nalamdb database and tables.
echo You will be prompted for your MySQL root password.
echo.

set MYSQL="C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"

%MYSQL% -u root -p -e "CREATE DATABASE IF NOT EXISTS nalamdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if %ERRORLEVEL% equ 0 (
    echo.
    echo [OK] Database 'nalamdb' created successfully.
    echo.
    echo Next step: Update your .env and .env.local with your MySQL password,
    echo then run:
    echo   npx prisma migrate dev --name init_encrypted_schema
    echo   npx ts-node scripts/seed.ts
) else (
    echo.
    echo [ERROR] Could not create database. Check your password and try again.
)
echo.
pause
