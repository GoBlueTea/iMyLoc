@echo off
echo Building backend with PyInstaller...
venv\Scripts\pyinstaller --name backend --onefile --noconsole --copy-metadata uvicorn --copy-metadata fastapi --copy-metadata starlette --copy-metadata readchar --copy-metadata inquirer3 --collect-all pymobiledevice3 --add-binary "venv\Lib\site-packages\pytun_pmd3\wintun\bin\amd64\wintun.dll;pytun_pmd3\wintun\bin\amd64" main.py
echo Build complete!
