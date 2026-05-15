pub mod migrations;
pub mod pool;

use pool::DbPool;

/// Initializes the database by running all pending migrations.
///
/// This should be called once during application startup, after the
/// connection pool has been created but before any commands are served.
pub fn init_db(pool: &DbPool) -> Result<(), String> {
    log::info!("Initializing database...");
    migrations::run_migrations(pool)?;
    log::info!("Database initialized successfully");
    Ok(())
}
