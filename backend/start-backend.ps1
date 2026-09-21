# Paysonic Backend Bootstrap Script
# Downloads Apache Maven 3.9.9 if not present, then starts the Spring Boot server
# Usage: .\start-backend.ps1
# For H2 offline mode (no MySQL needed): .\start-backend.ps1 -Profile h2

param(
    [string]$Profile = "mysql"
)

$MVN_VERSION = "3.9.9"
$MVN_DIST_DIR = "$PSScriptRoot\.mvn\wrapper\dist"
$MVN_DIR = "$MVN_DIST_DIR\apache-maven-$MVN_VERSION"
$MVN_BIN = "$MVN_DIR\bin\mvn.cmd"
$MVN_ZIP = "$MVN_DIST_DIR\apache-maven-$MVN_VERSION-bin.zip"
$MVN_URL = "https://dlcdn.apache.org/maven/maven-3/$MVN_VERSION/binaries/apache-maven-$MVN_VERSION-bin.zip"
$MVN_URL_BACKUP = "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$MVN_VERSION/apache-maven-$MVN_VERSION-bin.zip"

Write-Host ""
Write-Host "============================================================"
Write-Host "   Paysonic Toll Ops Platform - Backend Starter"
Write-Host "============================================================"
Write-Host ""

# Check Java is available
try {
    $null = & java -version 2>&1
    Write-Host "[OK] Java detected"
} catch {
    Write-Host "[ERROR] Java not found. Please install Java 21+ from https://adoptium.net"
    exit 1
}

# Download Maven if not already present
if (-not (Test-Path $MVN_BIN)) {
    Write-Host ""
    Write-Host "[INFO] Apache Maven $MVN_VERSION not found. Downloading (~10 MB)..."
    New-Item -ItemType Directory -Force -Path $MVN_DIST_DIR | Out-Null

    $downloaded = $false
    try {
        Write-Host "[INFO] Downloading from: $MVN_URL"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $MVN_URL -OutFile $MVN_ZIP -UseBasicParsing
        $downloaded = $true
    } catch {
        Write-Host "[WARN] Primary mirror failed, trying backup..."
    }

    if (-not $downloaded) {
        try {
            Invoke-WebRequest -Uri $MVN_URL_BACKUP -OutFile $MVN_ZIP -UseBasicParsing
            $downloaded = $true
        } catch {
            Write-Host "[ERROR] Failed to download Maven. Check your internet connection."
            exit 1
        }
    }

    Write-Host "[INFO] Extracting Maven..."
    Expand-Archive -Path $MVN_ZIP -DestinationPath $MVN_DIST_DIR -Force
    Remove-Item -Path $MVN_ZIP -Force
    Write-Host "[OK] Maven $MVN_VERSION ready!"
} else {
    Write-Host "[OK] Maven $MVN_VERSION already installed."
}

# Set PATH so mvn.cmd is accessible
$env:PATH = "$MVN_DIR\bin;$env:PATH"

# Set JAVA_HOME if not already set
if (-not $env:JAVA_HOME) {
    $javaExe = (Get-Command java -ErrorAction SilentlyContinue)
    if ($javaExe) {
        # java.exe is in bin/ — parent of bin/ is JAVA_HOME
        $javaBin = Split-Path $javaExe.Source -Parent
        $env:JAVA_HOME = Split-Path $javaBin -Parent
        Write-Host "[INFO] JAVA_HOME auto-set to: $env:JAVA_HOME"
    }
    
}
# Verify JAVA_HOME points to a valid JDK (has bin/javac or bin/java)
if ($env:JAVA_HOME -and -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    # Try well-known Eclipse Adoptium path as fallback
    $adoptium = "C:\Program Files\Eclipse Adoptium"
    $jdks = Get-ChildItem -Path $adoptium -Filter "jdk-*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    if ($jdks) {
        $env:JAVA_HOME = $jdks[0].FullName
        Write-Host "[INFO] JAVA_HOME resolved to: $env:JAVA_HOME"
    }
}
if (-not $env:JAVA_HOME) {
    $adoptium = "C:\Program Files\Eclipse Adoptium"
    $jdks = Get-ChildItem -Path $adoptium -Filter "jdk-*" -ErrorAction SilentlyContinue | Sort-Object Name -Descending
    if ($jdks) {
        $env:JAVA_HOME = $jdks[0].FullName
        Write-Host "[INFO] JAVA_HOME set from Adoptium: $env:JAVA_HOME"
    }
}
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# Start Spring Boot
Write-Host ""
Write-Host "[INFO] Starting Spring Boot Backend (profile: $Profile)"
Write-Host "[INFO] API Base URL: http://localhost:8080"
Write-Host ""

# Auto-kill any existing process on port 8080 to avoid "port already in use" errors
$existing = netstat -ano | Select-String ":8080 " | Select-String "LISTENING"
if ($existing) {
    $existingPid = ($existing -split "\s+")[-1]
    Write-Host "[INFO] Port 8080 in use by PID $existingPid -- stopping it first..."
    taskkill /PID $existingPid /F 2>$null | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "[INFO] Port 8080 cleared."
}


if ($Profile -eq "h2") {
    Write-Host "[INFO] Running with H2 in-memory database (no MySQL required)"
    & "$MVN_BIN" "spring-boot:run" "-Dspring-boot.run.profiles=h2"
} else {
    Write-Host "[INFO] Connecting to MySQL at localhost:3306"
    Write-Host "[INFO] Tip: use -Profile h2 for offline mode without MySQL"
    & "$MVN_BIN" "spring-boot:run" "-Dspring-boot.run.profiles=mysql"
}
