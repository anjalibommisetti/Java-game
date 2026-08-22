@echo off
title Paper Territory IO - Running Application
echo ===================================================
echo             PAPER TERRITORY IO
echo ===================================================
echo Compiling source files if needed...
if not exist bin (
    mkdir bin
)
javac -encoding UTF-8 -cp "lib/*;src" -d bin src/com/paperio/model/*.java src/com/paperio/engine/*.java src/com/paperio/ai/*.java src/com/paperio/db/*.java src/com/paperio/ui/*.java src/com/paperio/Main.java

echo Launching Paper Territory IO GUI...
java -cp "lib/*;bin" com.paperio.Main
pause
