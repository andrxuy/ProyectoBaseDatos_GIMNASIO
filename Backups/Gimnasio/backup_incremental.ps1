# BACKUP INCREMENTAL LOGICO - GIMNASIO

$Fecha = Get-Date -Format "yyyyMMdd_HHmmss"

$BackupDir = "D:\Backups\Gimnasio\Incremental"
$LogDir    = "D:\Backups\Gimnasio\Logs"

$DBName = "Gimnasio_Ortiz_Oto"
$DBUser = "postgres"

$PgDump = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"

$BackupFile = "$BackupDir\gimnasio_incremental_$Fecha.backup"
$LogFile    = "$LogDir\backup_incremental.log"

if (!(Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir }
if (!(Test-Path $LogDir))    { New-Item -ItemType Directory -Path $LogDir }

& "$PgDump" -U $DBUser -F c -f $BackupFile $DBName
Add-Content $LogFile ("Backup INCREMENTAL ejecutado: " + (Get-Date))
