@echo off
chcp 65001 > nul
echo ============================================
echo    Nir'Info - Gestion Formation
echo    Demarrage des serveurs...
echo ============================================
echo.

echo [1/4] Verification du backend Laravel...
cd /d "%~dp0backend"

if not exist vendor (
    echo     Installation des dependances Composer...
    composer install --no-interaction
    if errorlevel 1 (
        echo ERREUR: composer install a echoue. Verifiez que Composer est installe.
        pause
        exit /b 1
    )
)

echo [2/4] Configuration Laravel...
if not exist .env (
    copy .env.example .env > nul
)

php artisan key:generate --force
php artisan storage:link --force 2>nul
php artisan migrate --force 2>nul

echo [3/4] Demarrage du serveur Laravel sur http://localhost:8000 ...
start "Laravel API - NirInfo" cmd /k "php artisan serve --host=127.0.0.1 --port=8000"

echo [4/4] Demarrage du frontend React sur http://localhost:5173 ...
cd /d "%~dp0frontend"

if not exist node_modules (
    echo     Installation des dependances npm...
    call npm install
)

start "React Frontend - NirInfo" cmd /k "npm run dev"

echo.
echo ============================================
echo  Application Nir'Info demarree !
echo  Ouvrez : http://localhost:5173
echo ============================================
echo.
timeout /t 6 /nobreak > nul
start http://localhost:5173
pause
