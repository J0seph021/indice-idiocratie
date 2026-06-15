# Enregistre une tâche Windows qui lance la mise à jour chaque jour à 7h00.
# Lancer une fois dans PowerShell :  .\scripts\install-windows-task.ps1
# (Alternative locale au GitHub Action, si vous hébergez le site vous-même.)

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$script = Join-Path $projectDir 'scripts\update.mjs'

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $projectDir
$trigger = New-ScheduledTaskTrigger -Daily -At 7:00am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName 'IndiceIdiocratie-MAJ' -Action $action -Trigger $trigger `
  -Settings $settings -Description "Recalcule chaque jour l'Indice d'Idiocratie" -Force

Write-Host "[OK] Tache 'IndiceIdiocratie-MAJ' enregistree (tous les jours a 7h00)." -ForegroundColor Green
Write-Host "Pensez a definir ANTHROPIC_API_KEY dans les variables d'environnement systeme." -ForegroundColor Yellow
Write-Host "Pour tester maintenant :  Start-ScheduledTask -TaskName 'IndiceIdiocratie-MAJ'"
Write-Host "Pour retirer :  Unregister-ScheduledTask -TaskName 'IndiceIdiocratie-MAJ' -Confirm:`$false"
