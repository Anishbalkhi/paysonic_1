@echo off
echo ============================================================
echo    Paysonic Toll Ops Platform - Production JAR Builder
echo ============================================================
echo.

set MVN=".mvn\wrapper\dist\apache-maven-3.9.9\bin\mvn.cmd"

if not exist %MVN% (
    echo [ERROR] Maven not found. Please run start-backend.ps1 once first to download Maven.
    exit /b 1
)

echo [INFO] Building production JAR (skipping tests)...
call %MVN% clean package -DskipTests

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed.
    exit /b 1
)

echo.
echo [OK] Build successful!
echo [OK] JAR location: target\paysonic-tollops-backend-1.0.0-enterprise.jar
echo.
echo To run the JAR directly:
echo   java -jar target\paysonic-tollops-backend-1.0.0-enterprise.jar --spring.profiles.active=mysql
echo.
