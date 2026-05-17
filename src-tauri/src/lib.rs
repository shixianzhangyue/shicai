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
            // ─── Candidates ───────────────────────────────
            commands::candidates::list_candidates,
            commands::candidates::get_candidate,
            commands::candidates::create_candidate,
            commands::candidates::update_candidate,
            commands::candidates::delete_candidate,
            // ─── Jobs ─────────────────────────────────────
            commands::jobs::create_job,
            commands::jobs::delete_job,
            commands::jobs::duplicate_job,
            commands::jobs::get_job,
            commands::jobs::list_jobs,
            commands::jobs::update_job,
            // ─── Job Templates ────────────────────────────
            commands::job_templates::list_job_templates,
            commands::job_templates::create_job_template,
            commands::job_templates::delete_job_template,
            // ─── Pipeline ─────────────────────────────────
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
            commands::pipeline::get_candidate_stage_stats,
            commands::pipeline::get_stage_stats,
            commands::pipeline::list_candidates_by_job,
            commands::pipeline::get_jobs_with_candidates,
            // ─── Talent Pool ──────────────────────────────
            commands::talent_pool::list_talent_pool,
            commands::talent_pool::reactivate_candidate,
            commands::talent_pool::check_duplicate,
            commands::talent_pool::get_candidate_search_index,
            // ─── Follow-ups ───────────────────────────────
            commands::follow_ups::list_follow_ups,
            commands::follow_ups::create_follow_up,
            commands::follow_ups::delete_follow_up,
            commands::follow_ups::get_today_follow_ups,
            // ─── Follow-up Templates (V11) ────────────────
            commands::follow_up_templates::list_follow_up_templates,
            commands::follow_up_templates::create_follow_up_template,
            commands::follow_up_templates::update_follow_up_template,
            commands::follow_up_templates::delete_follow_up_template,
            // ─── Candidate Relations ──────────────────────
            commands::candidate_relations::list_relations,
            commands::candidate_relations::create_relation,
            commands::candidate_relations::delete_relation,
            // ─── Stats ────────────────────────────────────
            commands::stats::get_overview_stats,
            commands::stats::get_funnel_data,
            // ─── Analytics (V11) ──────────────────────────
            commands::analytics::get_analytics_summary,
            commands::analytics::get_source_breakdown,
            commands::analytics::get_conversion_funnel,
            commands::analytics::get_time_series,
            commands::analytics::get_top_performers,
            // ─── Tags ─────────────────────────────────────
            commands::tags::list_tags,
            commands::tags::create_tag,
            commands::tags::update_tag,
            commands::tags::delete_tag,
            // ─── Export ───────────────────────────────────
            commands::export::get_exportable_fields,
            commands::export::export_data,
            // ─── Backup ───────────────────────────────────
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::backup::rollback_backup,
            // ─── Cloud Sync (V11) ─────────────────────────
            commands::cloud_sync::init_onedrive_oauth,
            commands::cloud_sync::complete_onedrive_oauth,
            commands::cloud_sync::get_sync_status,
            commands::cloud_sync::sync_to_cloud,
            commands::cloud_sync::sync_from_cloud,
            commands::cloud_sync::get_sync_log,
            commands::cloud_sync::configure_sync,
            // ─── Merge / Dedup (V11) ──────────────────────
            commands::merge::detect_duplicates,
            commands::merge::preview_merge,
            commands::merge::merge_candidates,
            // ─── LLM Configs ─────────────────────────────
            commands::llm_configs::list_llm_configs,
            commands::llm_configs::create_llm_config,
            commands::llm_configs::update_llm_config,
            commands::llm_configs::delete_llm_config,
            commands::llm_configs::get_default_llm_config,
            commands::llm_configs::test_llm_connection,
            // ─── Resume Parser ────────────────────────────
            commands::resume_parser::parse_resume,
            commands::resume_parser::parse_resume_text,
            commands::resume_parser::parse_resume_enhance,
            // ─── OCR Configs ──────────────────────────────
            commands::ocr_configs::list_ocr_configs,
            commands::ocr_configs::create_ocr_config,
            commands::ocr_configs::update_ocr_config,
            commands::ocr_configs::delete_ocr_config,
            commands::ocr_configs::get_default_ocr_config,
            commands::ocr_configs::test_ocr_connection,
            commands::ocr_configs::ocr_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
