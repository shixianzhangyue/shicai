use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::path::PathBuf;

/// Type alias for the SQLite connection pool.
pub type DbPool = Pool<SqliteConnectionManager>;

/// Creates a new SQLite connection pool with WAL mode enabled.
///
/// WAL mode allows concurrent reads while writing, significantly improving
/// performance for read-heavy workloads. `max_size` is 6: WAL lets multiple
/// readers proceed alongside a single writer, so a small pool improves
/// concurrent command throughput while SQLite still serializes the writes.
pub fn create_pool(db_path: PathBuf) -> Result<DbPool, String> {
    let manager = SqliteConnectionManager::file(db_path)
        .with_init(|conn| {
            conn.execute_batch(
                "PRAGMA journal_mode=WAL;
                 PRAGMA busy_timeout=5000;
                 PRAGMA synchronous=NORMAL;
                 PRAGMA foreign_keys=ON;"
            )
        });

    Pool::builder()
        .max_size(6)
        .build(manager)
        .map_err(|e| e.to_string())
}
