$cameraApps = Get-ChildItem -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('LastUsedTimeStop') -eq 0 }

$micApps = Get-ChildItem -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.GetValue('LastUsedTimeStop') -eq 0 }

$results = @()

foreach ($app in $cameraApps) {
    $results += [PSCustomObject]@{
        Type = "camera"
        App = $app.PSChildName
        TimeStart = $app.GetValue('LastUsedTimeStart')
    }
}

foreach ($app in $micApps) {
    $results += [PSCustomObject]@{
        Type = "microphone"
        App = $app.PSChildName
        TimeStart = $app.GetValue('LastUsedTimeStart')
    }
}

$results | ConvertTo-Json -Compress
