@echo off
echo ============================================
echo  nalam.ai — Project Setup (Windows)
echo ============================================
echo.

echo [1/4] Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% neq 0 ( echo ERROR: npm install failed & exit /b 1 )

echo [2/4] Generating Prisma client...
call npx prisma generate
if %ERRORLEVEL% neq 0 ( echo ERROR: prisma generate failed & exit /b 1 )

echo [3/4] Running database migrations...
call npx prisma migrate dev --name init_encrypted_schema
if %ERRORLEVEL% neq 0 ( echo ERROR: migration failed. Check DATABASE_URL in .env & exit /b 1 )

echo [4/4] Seeding encrypted patient data...
call npx tsx scripts/seed.ts
if %ERRORLEVEL% neq 0 ( echo ERROR: seed failed & exit /b 1 )

echo.
echo ============================================
echo  Setup complete! Run: npm run dev
echo  App will be at: http://localhost:3000
echo ============================================
pause
