use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;

/// Type alias for the SQLite connection pool.
pub type DbPool = Pool<SqliteConnectionManager>;

/// Creates a new SQLite connection pool.
///
/// `max_size` is set to 1 because SQLite serializes writes to a single
/// file; a larger pool can cause "database is locked" errors.
pub fn create_pool(db_path: PathBuf) -> Result<DbPool, String> {
    let manager = SqliteConnectionManager::file(db_path);
    Pool::builder()
        .max_size(1)
        .build(manager)
        .map_err(|e| e.to_string())
}
