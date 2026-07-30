use refinery::embed_migrations;

use super::pool::DbPool;

embed_migrations!("src/db/migrations");

/// Runs pending database migrations using refinery.
///
/// On success, the database schema is brought up to the latest version.
/// Handles duplicate column errors gracefully, but checksum mismatches are treated as errors.
pub fn run_migrations(pool: &DbPool) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| {
        let msg = format!("Failed to get database connection from pool: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    match migrations::runner().run(&mut *conn) {
        Ok(_) => {
            log::info!("Database migrations completed successfully");
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("{}", e);

            // Checksum mismatch is a serious error - do NOT auto-reset
            if err_msg.contains("is different than filesystem one") || err_msg.contains("checksum") {
                let msg = format!(
                    "Migration checksum mismatch detected! This may indicate \
                     database corruption or a version conflict. \
                     Please manually verify and resolve. Error: {}",
                    e
                );
                log::error!("{}", msg);
                return Err(msg);
            }

            handle_migration_error(e, &mut conn)
        }
    }
}

/// Handle migration errors - if it's a duplicate column, the schema is already correct.
fn handle_migration_error(e: refinery::Error, conn: &mut rusqlite::Connection) -> Result<(), String> {
    let msg = format!("{}", e);
    if msg.contains("duplicate column") || msg.contains("already exists") || msg.contains("no such table") {
        log::warn!("Migration hit expected error (schema likely already correct): {}", msg);
        ensure_history_complete(conn)?;
        Ok(())
    } else {
        let msg = format!("Database migration failed: {}", e);
        log::error!("{}", msg);
        Err(msg)
    }
}

/// Ensure refinery_schema_history has entries for all versions.
/// This function should only be called when schema is verified to be correct.
fn ensure_history_complete(conn: &mut rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS refinery_schema_history (
            version INTEGER PRIMARY KEY,
            name VARCHAR(255),
            applied_on VARCHAR(255),
            checksum VARCHAR(255)
        );"
    ).map_err(|e| format!("Failed to create history table: {}", e))?;

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM refinery_schema_history", [], |row| row.get(0))
        .unwrap_or(0);

    if count >= 15 {
        return Ok(());
    }

    // NOTE: We no longer insert fake checksums. If the history table is incomplete,
    // the user must manually verify and resolve the issue.
    log::warn!(
        "Migration history appears incomplete ({} entries). \
         Please verify database integrity manually.",
        count
    );

    Ok(())
}
