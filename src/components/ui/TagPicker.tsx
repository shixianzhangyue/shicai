import { useState, useMemo } from "react";
import { X, ChevronDown, Search } from "lucide-react";
import type { Tag } from "@/types";

interface TagPickerProps {
  tags: Tag[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  className?: string;
}

function TagPicker({
  tags,
  selectedIds,
  onChange,
  placeholder = "选择标签...",
  className = "",
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedTags = useMemo(
    () => tags.filter((t) => selectedIds.includes(t.id)),
    [tags, selectedIds]
  );

  const filteredTags = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tags.filter(
      (t) =>
        !selectedIds.includes(t.id) &&
        (query === "" || t.name.toLowerCase().includes(query))
    );
  }, [tags, selectedIds, search]);

  const toggleTag = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeTag = (id: string) => {
    onChange(selectedIds.filter((sid) => sid !== id));
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selected tags display + trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-[40px] w-full items-center gap-2 rounded-md border border-[#2a2d35] bg-[#0f1117] px-3 py-2 text-left text-sm transition-colors hover:border-[#3b82f6]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
      >
        {selectedTags.length === 0 ? (
          <span className="text-[#94a3b8]">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tag.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      removeTag(tag.id);
                    }
                  }}
                  className="ml-0.5 inline-flex cursor-pointer items-center rounded-full hover:bg-white/20"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </div>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#2a2d35] bg-[#1a1d24] py-1 shadow-lg">
          {/* Search input */}
          <div className="px-2 pb-1 pt-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索标签..."
                className="h-8 w-full rounded-md border border-[#2a2d35] bg-[#0f1117] pl-7 pr-2 text-xs text-[#e2e8f0] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3b82f6]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Tag list */}
          <div className="max-h-48 overflow-y-auto px-1 py-1">
            {filteredTags.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#94a3b8]">
                无匹配标签
              </div>
            ) : (
              filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-[#e2e8f0] transition-colors hover:bg-[#2a2d35]"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default TagPicker;
