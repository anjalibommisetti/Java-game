@echo off
title Paper Territory IO - Running Application
echo ===================================================
echo             PAPER TERRITORY IO
echo ===================================================
echo Compiling source files if needed...
if not exist bin (
    mkdir bin
)
javac -cp "lib/sqlite-jdbc.jar;src" -d bin src/com/paperio/model/*.java src/com/paperio/engine/*.java src/com/paperio/ai/*.java src/com/paperio/db/*.java src/com/paperio/ui/*.java src/com/paperio/Main.java

echo Launching Paper Territory IO GUI...
java -cp "lib/sqlite-jdbc.jar;bin" com.paperio.Main
pause
