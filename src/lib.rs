use zed_extension_api as zed;

struct ToolangExtension;

impl zed::Extension for ToolangExtension {
    fn new() -> Self {
        Self
    }
}

zed::register_extension!(ToolangExtension);
