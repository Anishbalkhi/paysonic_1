@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    http://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@REM ----------------------------------------------------------------------------
@REM Apache Maven Wrapper startup batch script, version 3.3.2
@REM
@REM Required ENV vars:
@REM JAVA_HOME - location of a JDK home dir
@REM
@REM Optional ENV vars
@REM MAVEN_BATCH_ECHO - set to 'on' to enable the echoing of the batch commands
@REM MAVEN_BATCH_PAUSE - set to 'on' to wait for a keystroke before ending
@REM MAVEN_OPTS - parameters passed to the Java VM when running Maven
@REM     e.g. to debug Maven itself, use
@REM set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
@REM MAVEN_SKIP_RC - flag to disable loading of mavenrc files
@REM ----------------------------------------------------------------------------

@IF "%MAVEN_BATCH_ECHO%"=="on" echo on

@REM set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
@REM set _JAVA_CMD=
set _MAVEN_PROJECTBASEDIR=%MAVEN_BASEDIR%
IF NOT "%MAVEN_BASEDIR%"=="" goto endDetectBaseDir

set EXEC_DIR=%CD%
set WDIR=%EXEC_DIR%
:findBaseDir
IF EXIST "%WDIR%"\.mvn goto baseDirFound
cd ..
IF "%WDIR%"=="%CD%" goto baseDirNotFound
set WDIR=%CD%
goto findBaseDir

:baseDirNotFound
set _MAVEN_PROJECTBASEDIR=%EXEC_DIR%
goto endDetectBaseDir

:baseDirFound
set _MAVEN_PROJECTBASEDIR=%WDIR%
cd "%EXEC_DIR%"

:endDetectBaseDir
IF NOT EXIST "%_MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties" (
    echo Could not find .mvn\wrapper\maven-wrapper.properties
    goto error
)

@REM ----------------------------
@REM Detect Java
@REM ----------------------------
set JAVA_CMD=java
if "%JAVA_HOME%"=="" goto tryJavaCmd
set JAVA_CMD=%JAVA_HOME%/bin/java
:tryJavaCmd

set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

@REM Download the maven-wrapper.jar if it does not exist
set WRAPPER_JAR=%_MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.jar

if exist "%WRAPPER_JAR%" goto runWithJar

FOR /F "usebackq tokens=1,2 delims==" %%A IN ("%_MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties") DO (
    IF "%%A"=="wrapperUrl" set WRAPPER_URL=%%B
)

echo Downloading Maven Wrapper JAR from: %WRAPPER_URL%
"%JAVA_CMD%" -classpath "%_MAVEN_PROJECTBASEDIR%\.mvn\wrapper" ^
    "-Dmaven.user.home=%_MAVEN_PROJECTBASEDIR%\.mvn\repository" ^
    org.apache.maven.wrapper.Downloader "%WRAPPER_URL%" "%WRAPPER_JAR%" 2>NUL

IF NOT exist "%WRAPPER_JAR%" (
    PowerShell -Command "Invoke-WebRequest -Uri '%WRAPPER_URL%' -OutFile '%WRAPPER_JAR%'"
)

:runWithJar
@REM Run Maven using the wrapper jar
set DOWNLOAD_URL=
FOR /F "usebackq tokens=1,2 delims==" %%A IN ("%_MAVEN_PROJECTBASEDIR%\.mvn\wrapper\maven-wrapper.properties") DO (
    IF "%%A"=="distributionUrl" set DOWNLOAD_URL=%%B
)

"%JAVA_CMD%" ^
    %JVM_CONFIG_MAVEN_PROPS% ^
    %MAVEN_OPTS% ^
    %MAVEN_DEBUG_OPTS% ^
    -classpath "%WRAPPER_JAR%" ^
    "-Dmaven.multiModuleProjectDirectory=%_MAVEN_PROJECTBASEDIR%" ^
    "-Dmaven.home=%_MAVEN_PROJECTBASEDIR%\.mvn\wrapper\dist" ^
    "-Dmaven.repo.local=%_MAVEN_PROJECTBASEDIR%\.mvn\repository" ^
    %WRAPPER_LAUNCHER% %MAVEN_CONFIG% %*
if ERRORLEVEL 1 goto error
goto end

:error
set ERROR_CODE=1

:end
@endlocal & set ERROR_CODE=%ERROR_CODE%

if not "%MAVEN_SKIP_RC%"=="" goto skipRcPost
@REM check for post script, once with legacy .bat ending and once with .cmd ending
if exist "%USERPROFILE%\mavenrc_post.bat" call "%USERPROFILE%\mavenrc_post.bat"
if exist "%USERPROFILE%\mavenrc_post.cmd" call "%USERPROFILE%\mavenrc_post.cmd"
:skipRcPost

if "%MAVEN_BATCH_PAUSE%"=="on" pause

if "%ERROR_CODE%"=="0" goto mainEnd

:mainEnd
if "%OS%"=="Windows_NT" endlocal

:omega
EXIT /B %ERROR_CODE%
