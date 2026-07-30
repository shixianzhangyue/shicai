use simplelog::*;
use std::fs;
use std::path::PathBuf;

/// Initializes the logging system.
///
/// Terminal output: WARN and above.
/// File output: ERROR and above, written to `{log_dir}/shicore-{YYYY-MM-DD}.log`.
pub fn init_logger(log_dir: PathBuf) -> Result<(), String> {
    fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;

    let log_file_path = log_dir.join(format!(
        "shicore-{}.log",
        chrono::Local::now().format("%Y-%m-%d")
    ));

    let file_config = ConfigBuilder::new()
        .set_time_format_rfc3339()
        .build();

    CombinedLogger::init(vec![
        TermLogger::new(
            LevelFilter::Info,
            Config::default(),
            TerminalMode::Mixed,
            ColorChoice::Auto,
        ),
        WriteLogger::new(
            LevelFilter::Info,
            file_config,
            fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&log_file_path)
                .map_err(|e| e.to_string())?,
        ),
    ])
    .map_err(|e| e.to_string())?;

    Ok(())
}
