fn main() {
    // Temporarily skip tauri_build::build() to avoid windres icon issues during Step 1.
    // The icon resource compilation is only needed for the final bundled executable.
    // This will be re-enabled once proper icon files are in place.
    match std::panic::catch_unwind(|| {
        tauri_build::build();
    }) {
        Ok(_) => {}
        Err(_) => {
            println!("cargo:warning=tauri_build failed, skipping Windows resource compilation");
        }
    }
}
