# Database Scripts - Windows Usage Guide

This directory contains scripts for managing the PostgreSQL database on Windows.

## Available Scripts

### 1. Create Database (Without Destroying Data)

Creates the database if it doesn't exist.

**Batch File (Easiest - Just Double Click!):**

```cmd
scripts\create-database.bat
```

**PowerShell:**

```powershell
# Option 1: Bypass execution policy for this run
powershell -ExecutionPolicy Bypass -File .\scripts\create-database.ps1

# Option 2: Set execution policy once, then run normally
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\create-database.ps1
```

### 2. Recreate Docker Database (DESTROYS ALL DATA!)

Stops Docker, removes the PostgreSQL volume, and recreates containers.

**Batch File (Easiest - Just Double Click!):**

```cmd
scripts\recreate-docker-database.bat
```

**PowerShell:**

```powershell
# Option 1: Bypass execution policy for this run
powershell -ExecutionPolicy Bypass -File .\scripts\recreate-docker-database.ps1

# Option 2: Set execution policy once, then run normally
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\recreate-docker-database.ps1
```

### 3. Reset Database (Existing Script)

For bash/Linux users:

```bash
./scripts/reset-database.sh
```

## Common Issues

### PowerShell Execution Policy Error

If you see: `cannot be loaded because running scripts is disabled`

**Solution:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or use the batch files (.bat) instead - they don't have this restriction!

### Docker Not Running

Make sure Docker Desktop is running before executing these scripts.

### Permission Denied

Run your terminal (CMD or PowerShell) as Administrator.

## Recommended Approach for Windows Users

**Use the .bat files!** They're simpler and don't require any special permissions:

- `scripts\create-database.bat` - Create database
- `scripts\recreate-docker-database.bat` - Full reset

You can even double-click them in Windows Explorer!
