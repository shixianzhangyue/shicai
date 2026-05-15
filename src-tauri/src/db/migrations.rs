use refinery::embed_migrations;

use super::pool::DbPool;

embed_migrations!("src/db/migrations");

/// Runs pending database migrations using refinery.
///
/// On success, the database schema is brought up to the latest version
/// defined in the `src/db/migrations/` directory.
/// On failure, a descriptive error message is returned.
pub fn run_migrations(pool: &DbPool) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| {
        let msg = format!("Failed to get database connection from pool: {}", e);
        log::error!("{}", msg);
        msg
    })?;

    migrations::runner()
        .run(&mut *conn)
        .map_err(|e| {
            let msg = format!("Database migration failed: {}", e);
            log::error!("{}", msg);
            msg
        })?;

    log::info!("Database migrations completed successfully");
    Ok(())
}
