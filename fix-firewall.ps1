# Fix Windows Firewall to allow Expo Dev Server and local backend
# Must run as Administrator

Write-Host "Adding firewall rules for Expo Dev Server and backend..." -ForegroundColor Cyan

netsh advfirewall firewall add rule name="Expo Dev Server TCP" dir=in action=allow protocol=tcp localport=8081
netsh advfirewall firewall add rule name="Expo Dev Server UDP" dir=in action=allow protocol=udp localport=8081
netsh advfirewall firewall add rule name="SVCK Backend TCP" dir=in action=allow protocol=tcp localport=8000

# Also fix Node.js rules  
netsh advfirewall firewall set rule name="Node.js JavaScript Runtime" dir=in profile=private new action=allow 2>$null

Write-Host ""
Write-Host "Firewall rules added for ports 8081 and 8000. You can close this window." -ForegroundColor Green
Write-Host ""
pause
