@echo off
echo Starting pymobiledevice3 tunneld for iOS 17+ ...
start cmd /k "cd backend && venv\Scripts\pymobiledevice3.exe remote tunneld"

echo Starting iMyLoc Backend...
start cmd /k "cd backend && run.bat"

echo Starting iMyLoc Frontend (Electron)...
start cmd /k "cd frontend && npm run dev"

echo Done.
