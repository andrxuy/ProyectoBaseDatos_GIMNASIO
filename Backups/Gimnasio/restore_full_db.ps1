# =========================
# RESTORE COMPLETO POSTGRESQL
# =========================

# CONFIGURACIÓN
$PgBin = "C:\Program Files\PostgreSQL\18\bin"
$BackupDir = "D:\Backups\Gimnasio\Completo"
$DBName = "gimnasio_ortiz_oto"
$DBUser = "admin_gimnasio"

# OBTENER EL ÚLTIMO BACKUP
$LatestBackup = Get-ChildItem $BackupDir -Filter "*.backup" |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1

if (-not $LatestBackup) {
    Write-Host "ERROR: No se encontró ningún backup."
    exit
}

Write-Host "Backup seleccionado:"
Write-Host $LatestBackup.FullName

# IR A BIN DE POSTGRES
cd $PgBin

# CERRAR CONEXIONES ACTIVAS
Write-Host "Cerrando conexiones activas..."
.\psql.exe -U $DBUser -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$DBName';
"

# ELIMINAR BASE DE DATOS
Write-Host "Eliminando base de datos..."
.\dropdb.exe -U $DBUser $DBName

# CREAR BASE DE DATOS
Write-Host "Creando base de datos..."
.\createdb.exe -U $DBUser $DBName

# CREAR EXTENSIÓN NECESARIA
Write-Host "Creando extensión pgcrypto..."
.\psql.exe -U $DBUser -d $DBName -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# RESTAURAR BACKUP
Write-Host "Restaurando backup..."
.\pg_restore.exe `
  -U $DBUser `
  -d $DBName `
  --clean `
  --if-exists `
  --no-owner `
  "$($LatestBackup.FullName)"

Write-Host "RESTAURACION COMPLETA FINALIZADA CORRECTAMENTE."
