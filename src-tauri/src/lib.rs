use tauri::Manager;

mod commands;
mod db;
mod logger;
mod services;
mod validate;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle();
            let app_data_dir = app_handle
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");

            // Initialize logger first so subsequent errors are logged.
            let log_dir = app_data_dir.join("logs");
            if let Err(e) = logger::init_logger(log_dir) {
                eprintln!("Failed to initialize logger: {}", e);
            }

            // Create data directory and database file path.
            let db_dir = app_data_dir.join("data");
            if let Err(e) = std::fs::create_dir_all(&db_dir) {
                let msg = format!("Failed to create data directory: {}", e);
                log::error!("{}", msg);
                return Err(msg.into());
            }
            let db_path = db_dir.join("talent.db");

            // Create connection pool.
            let pool = match db::pool::create_pool(db_path) {
                Ok(p) => p,
                Err(e) => {
                    let msg = format!("Failed to create database pool: {}", e);
                    log::error!("{}", msg);
                    return Err(msg.into());
                }
            };

            // Run database migrations.
            if let Err(e) = db::init_db(&pool) {
                let msg = format!("Failed to initialize database: {}", e);
                log::error!("{}", msg);
                return Err(msg.into());
            }

            // Register pool as Tauri state so commands can access it.
            app.manage(pool);

            log::info!("TalentVault application setup completed successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::candidates::list_candidates,
            commands::candidates::get_candidate,
            commands::candidates::create_candidate,
            commands::candidates::update_candidate,
            commands::candidates::delete_candidate,
            commands::jobs::create_job,
            commands::jobs::delete_job,
            commands::jobs::duplicate_job,
            commands::jobs::get_job,
            commands::jobs::list_jobs,
            commands::jobs::update_job,
            commands::job_templates::list_job_templates,
            commands::job_templates::create_job_template,
            commands::job_templates::delete_job_template,
            commands::pipeline::get_stages_by_job,
            commands::pipeline::create_stage,
            commands::pipeline::update_stage,
            commands::pipeline::delete_stage,
            commands::pipeline::reorder_stages,
            commands::pipeline::init_default_stages,
            commands::pipeline::get_pipeline_by_job,
            commands::pipeline::add_to_job,
            commands::pipeline::move_to_stage,
            commands::pipeline::reject_candidate,
            commands::pipeline::pool_candidate,
            commands::pipeline::batch_move,
            commands::pipeline::batch_reject,
            commands::talent_pool::list_talent_pool,
            commands::talent_pool::reactivate_candidate,
            commands::talent_pool::check_duplicate,
            commands::talent_pool::get_candidate_search_index,
            commands::follow_ups::list_follow_ups,
            commands::follow_ups::create_follow_up,
            commands::follow_ups::delete_follow_up,
            commands::follow_ups::get_today_follow_ups,
            commands::candidate_relations::list_relations,
            commands::candidate_relations::create_relation,
            commands::candidate_relations::delete_relation,
            commands::stats::get_overview_stats,
            commands::stats::get_funnel_data,
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            commands::export::get_exportable_fields,
            commands::export::export_data,
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::backup::rollback_backup,
            commands::pipeline_templates::list_pipeline_templates,
            commands::pipeline_templates::create_pipeline_template,
            commands::pipeline_templates::delete_pipeline_template,
            commands::llm_configs::list_llm_configs,
            commands::llm_configs::create_llm_config,
            commands::llm_configs::update_llm_config,
            commands::llm_configs::delete_llm_config,
            commands::llm_configs::get_default_llm_config,
            commands::llm_configs::test_llm_connection,
            commands::resume_parser::parse_resume,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
