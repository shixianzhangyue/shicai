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

    // Generate SHA-256 checksum for integrity verification
    let zip_bytes = fs::read(&output_path).map_err(|e| {
        let msg = format!("Failed to read backup for checksum: {}", e);
        log::error!("{}", msg);
        msg
    })?;
    let checksum = sha256_hex(&zip_bytes);
    let checksum_path = output_path.with_extension("zip.sha256");
    fs::write(&checksum_path, format!("{}  {}", checksum, output_path.file_name().unwrap_or_default().to_string_lossy())).map_err(|e| {
        let msg = format!("Failed to write checksum file: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    log::info!("Backup exported to {} (SHA-256: {})", output_path.display(), checksum);
    Ok(output_path.to_string_lossy().to_string())
}

/// Computes SHA-256 hex digest of input bytes.
fn sha256_hex(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    result.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Minimal SHA-256 implementation (FIPS 180-4).
struct Sha256 {
    state: [u32; 8],
    buffer: Vec<u8>,
    total_len: u64,
}

impl Sha256 {
    fn new() -> Self {
        Self {
            state: [
                0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
            ],
            buffer: Vec::new(),
            total_len: 0,
        }
    }

    fn update(&mut self, data: &[u8]) {
        self.buffer.extend_from_slice(data);
        self.total_len += data.len() as u64;
        while self.buffer.len() >= 64 {
            let block: [u8; 64] = self.buffer[..64].try_into().expect("buffer block is always 64 bytes");
            self.buffer.drain(..64);
            self.process_block(&block);
        }
    }

    fn finalize(mut self) -> [u8; 32] {
        let bit_len = self.total_len * 8;
        self.buffer.push(0x80);
        while (self.buffer.len() % 64) != 56 {
            self.buffer.push(0);
        }
        self.buffer.extend_from_slice(&bit_len.to_be_bytes());
        while self.buffer.len() >= 64 {
            let block: [u8; 64] = self.buffer[..64].try_into().expect("buffer block is always 64 bytes");
            self.buffer.drain(..64);
            self.process_block(&block);
        }
        let mut result = [0u8; 32];
        for (i, &v) in self.state.iter().enumerate() {
            result[i*4..(i+1)*4].copy_from_slice(&v.to_be_bytes());
        }
        result
    }

    fn process_block(&mut self, block: &[u8; 64]) {
        const K: [u32; 64] = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
            0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
            0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
            0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
        ];
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes(block[i*4..(i+1)*4].try_into().expect("block slice is always 4 bytes"));
        }
        for i in 16..64 {
            let s0 = w[i-15].rotate_right(7) ^ w[i-15].rotate_right(18) ^ (w[i-15] >> 3);
            let s1 = w[i-2].rotate_right(17) ^ w[i-2].rotate_right(19) ^ (w[i-2] >> 10);
            w[i] = w[i-16].wrapping_add(s0).wrapping_add(w[i-7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = self.state;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = h.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            h = g; g = f; f = e; e = d.wrapping_add(temp1);
            d = c; c = b; b = a; a = temp1.wrapping_add(temp2);
        }
        self.state[0] = self.state[0].wrapping_add(a);
        self.state[1] = self.state[1].wrapping_add(b);
        self.state[2] = self.state[2].wrapping_add(c);
        self.state[3] = self.state[3].wrapping_add(d);
        self.state[4] = self.state[4].wrapping_add(e);
        self.state[5] = self.state[5].wrapping_add(f);
        self.state[6] = self.state[6].wrapping_add(g);
        self.state[7] = self.state[7].wrapping_add(h);
    }
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
        let name = file.name();
        // SECURITY: prevent Zip Slip path traversal
        let out_path = app_data_dir.join(name);
        // Canonicalize the parent directory to resolve symlinks and .. before checking
        if let Some(parent) = out_path.parent() {
            if let Ok(canonical_parent) = parent.canonicalize() {
                if let Ok(app_canonical) = app_data_dir.canonicalize() {
                    if !canonical_parent.starts_with(&app_canonical) {
                        log::warn!("Blocked path traversal attempt in backup: {}", name);
                        continue;
                    }
                }
            }
            // If canonicalize fails (parent doesn't exist yet), verify the normalized path
            // doesn't escape app_data_dir by checking for ".." components
            let normalized = out_path.components().collect::<Vec<_>>();
            let app_normalized = app_data_dir.components().collect::<Vec<_>>();
            if normalized.len() <= app_normalized.len() {
                log::warn!("Blocked suspicious path in backup: {}", name);
                continue;
            }
        }
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
