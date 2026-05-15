use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;
use zip::write::FileOptions;

/// Exports the database and resource files to a zip archive.
#[tauri::command]
pub fn export_backup(app: AppHandle, output_path: String) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| {
        let msg = format!("Failed to get app data dir: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let data_dir = app_data_dir.join("data");
    let res_dir = app_data_dir.join("res");

    let output_path = PathBuf::from(output_path);
    let file = fs::File::create(&output_path).map_err(|e| {
        let msg = format!("Failed to create backup file: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated);

    // Add talent.db
    let db_path = data_dir.join("talent.db");
    if db_path.exists() {
        let mut db_file = fs::File::open(&db_path).map_err(|e| {
            let msg = format!("Failed to open database file: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        let mut db_bytes = Vec::new();
        db_file.read_to_end(&mut db_bytes).map_err(|e| {
            let msg = format!("Failed to read database file: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        zip.start_file("data/talent.db", options).map_err(|e| {
            let msg = format!("Failed to add database to zip: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        zip.write_all(&db_bytes).map_err(|e| {
            let msg = format!("Failed to write database to zip: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    // Add all files from res/
    if res_dir.exists() {
        for entry in walkdir::WalkDir::new(&res_dir).follow_links(false) {
            let entry = entry.map_err(|e| {
                let msg = format!("Failed to walk res directory: {}", e);
                log::error!("{}", msg);
                msg
            })?;
            let path = entry.path();
            if path.is_file() {
                let relative = path.strip_prefix(&app_data_dir).map_err(|e| {
                    let msg = format!("Failed to compute relative path: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
                let name_in_zip = relative.to_string_lossy().replace('\\', "/");
                let mut file_bytes = Vec::new();
                let mut f = fs::File::open(path).map_err(|e| {
                    let msg = format!("Failed to open res file: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
                f.read_to_end(&mut file_bytes).map_err(|e| {
                    let msg = format!("Failed to read res file: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
                zip.start_file(&name_in_zip, options).map_err(|e| {
                    let msg = format!("Failed to add res file to zip: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
                zip.write_all(&file_bytes).map_err(|e| {
                    let msg = format!("Failed to write res file to zip: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
            }
        }
    }

    zip.finish().map_err(|e| {
        let msg = format!("Failed to finalize zip: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Backup exported to {}", output_path.display());
    Ok(output_path.to_string_lossy().to_string())
}

/// Imports a backup from a zip archive.
///
/// Creates rollback backups before overwriting existing data.
#[tauri::command]
pub fn import_backup(app: AppHandle, zip_path: String) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| {
        let msg = format!("Failed to get app data dir: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let zip_path = PathBuf::from(zip_path);
    let file = fs::File::open(&zip_path).map_err(|e| {
        let msg = format!("Failed to open backup zip: {}", e);
        log::error!("{}", msg);
        msg
    })?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| {
        let msg = format!("Failed to read backup zip: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Verify zip contains talent.db
    let mut has_db = false;
    for i in 0..archive.len() {
        let name = archive.by_index(i).map_err(|e| {
            let msg = format!("Failed to read zip entry: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        if name.name() == "data/talent.db" {
            has_db = true;
            break;
        }
    }
    if !has_db {
        let msg = "备份文件无效：未找到 talent.db".to_string();
        log::error!("{}", msg);
        return Err(msg);
    }

    // Create rollback point
    let timestamp = chrono::Local::now().format("%Y%m%d%H%M%S").to_string();
    let data_dir = app_data_dir.join("data");
    let res_dir = app_data_dir.join("res");

    if data_dir.exists() {
        let db_path = data_dir.join("talent.db");
        if db_path.exists() {
            let bak_path = data_dir.join(format!("talent.db.{}.bak", timestamp));
            fs::copy(&db_path, &bak_path).map_err(|e| {
                let msg = format!("Failed to create database backup: {}", e);
                log::error!("{}", msg);
                msg
            })?;
        }
    }

    if res_dir.exists() {
        let res_bak_dir = app_data_dir.join(format!("res.{}.bak", timestamp));
        copy_dir_all(&res_dir, &res_bak_dir).map_err(|e| {
            let msg = format!("Failed to create res backup: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    // Clean up old backups (keep only 3 most recent)
    cleanup_old_backups(&app_data_dir)?;

    // Extract zip contents
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| {
            let msg = format!("Failed to read zip entry: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        let out_path = app_data_dir.join(file.name());
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                let msg = format!("Failed to create directory: {}", e);
                log::error!("{}", msg);
                msg
            })?;
        }
        let mut out_file = fs::File::create(&out_path).map_err(|e| {
            let msg = format!("Failed to create output file: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| {
            let msg = format!("Failed to read zip entry data: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        out_file.write_all(&buffer).map_err(|e| {
            let msg = format!("Failed to write output file: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    log::info!("Backup imported successfully from {}", zip_path.display());
    Ok("数据恢复成功，请重启应用以完成数据加载".to_string())
}

/// Rolls back to the most recent backup.
#[tauri::command]
pub fn rollback_backup(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| {
        let msg = format!("Failed to get app data dir: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    let data_dir = app_data_dir.join("data");

    // Find the latest .bak file
    let mut bak_files: Vec<PathBuf> = Vec::new();
    if data_dir.exists() {
        for entry in fs::read_dir(&data_dir).map_err(|e| {
            let msg = format!("Failed to read data directory: {}", e);
            log::error!("{}", msg);
            msg
        })? {
            let entry = entry.map_err(|e| {
                let msg = format!("Failed to read directory entry: {}", e);
                log::error!("{}", msg);
                msg
            })?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("talent.db.") && name.ends_with(".bak") {
                bak_files.push(entry.path());
            }
        }
    }

    bak_files.sort_by(|a, b| {
        let ma = a.metadata().ok();
        let mb = b.metadata().ok();
        match (ma, mb) {
            (Some(ma), Some(mb)) => {
                let ta = ma.modified().ok();
                let tb = mb.modified().ok();
                match (ta, tb) {
                    (Some(ta), Some(tb)) => tb.cmp(&ta), // newest first
                    _ => std::cmp::Ordering::Equal,
                }
            }
            _ => std::cmp::Ordering::Equal,
        }
    });

    let latest_bak = bak_files.into_iter().next().ok_or_else(|| {
        let msg = "未找到可用的回滚备份".to_string();
        log::error!("{}", msg);
        msg
    })?;

    // Create a temporary backup of current state
    let timestamp = chrono::Local::now().format("%Y%m%d%H%M%S").to_string();
    let db_path = data_dir.join("talent.db");
    if db_path.exists() {
        let temp_bak = data_dir.join(format!("talent.db.{}.rollback", timestamp));
        fs::copy(&db_path, &temp_bak).map_err(|e| {
            let msg = format!("Failed to create temporary backup: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    let res_dir = app_data_dir.join("res");
    if res_dir.exists() {
        let res_rollback = app_data_dir.join(format!("res.{}.rollback", timestamp));
        copy_dir_all(&res_dir, &res_rollback).map_err(|e| {
            let msg = format!("Failed to create temporary res backup: {}", e);
            log::error!("{}", msg);
            msg
        })?;
    }

    // Restore the latest .bak
    fs::copy(&latest_bak, &db_path).map_err(|e| {
        let msg = format!("Failed to restore database backup: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    // Try to restore res backup with matching timestamp
    let bak_name = latest_bak.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if let Some(ts) = bak_name.strip_prefix("talent.db.").and_then(|s| s.strip_suffix(".bak")) {
        let res_bak = app_data_dir.join(format!("res.{}.bak", ts));
        if res_bak.exists() {
            if res_dir.exists() {
                fs::remove_dir_all(&res_dir).map_err(|e| {
                    let msg = format!("Failed to remove current res directory: {}", e);
                    log::error!("{}", msg);
                    msg
                })?;
            }
            copy_dir_all(&res_bak, &res_dir).map_err(|e| {
                let msg = format!("Failed to restore res backup: {}", e);
                log::error!("{}", msg);
                msg
            })?;
        }
    }

    log::info!("Rolled back to backup {}", latest_bak.display());
    Ok("回滚成功，请重启应用以完成数据加载".to_string())
}

/// Copies all contents from `src` to `dst` recursively.
fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| {
        let msg = format!("Failed to create directory {}: {}", dst.display(), e);
        log::error!("{}", msg);
        msg
    })?;
    for entry in fs::read_dir(src).map_err(|e| {
        let msg = format!("Failed to read directory {}: {}", src.display(), e);
        log::error!("{}", msg);
        msg
    })? {
        let entry = entry.map_err(|e| {
            let msg = format!("Failed to read directory entry: {}", e);
            log::error!("{}", msg);
            msg
        })?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| {
                let msg = format!(
                    "Failed to copy {} to {}: {}",
                    src_path.display(),
                    dst_path.display(),
                    e
                );
                log::error!("{}", msg);
                msg
            })?;
        }
    }
    Ok(())
}

/// Cleans up old backups, keeping only the 3 most recent.
fn cleanup_old_backups(app_data_dir: &PathBuf) -> Result<(), String> {
    let data_dir = app_data_dir.join("data");
    let mut db_baks: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();

    if data_dir.exists() {
        for entry in fs::read_dir(&data_dir).map_err(|e| {
            let msg = format!("Failed to read data directory: {}", e);
            log::error!("{}", msg);
            msg
        })? {
            let entry = entry.map_err(|e| {
                let msg = format!("Failed to read directory entry: {}", e);
                log::error!("{}", msg);
                msg
            })?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with("talent.db.") && name.ends_with(".bak") {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        db_baks.push((entry.path(), modified));
                    }
                }
            }
        }
    }

    db_baks.sort_by(|a, b| b.1.cmp(&a.1)); // newest first

    if db_baks.len() > 3 {
        for (path, _) in db_baks.iter().skip(3) {
            let _ = fs::remove_file(path);
            // Also try to remove matching res backup
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if let Some(ts) = name.strip_prefix("talent.db.").and_then(|s| s.strip_suffix(".bak"))
                {
                    let res_bak = app_data_dir.join(format!("res.{}.bak", ts));
                    if res_bak.exists() {
                        let _ = fs::remove_dir_all(&res_bak);
                    }
                }
            }
        }
    }

    Ok(())
}
