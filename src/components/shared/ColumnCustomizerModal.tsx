import React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useLeadFinder } from "../../context/LeadFinderContext";
import { ALL_LEAD_COLUMNS } from "../../types";

export default function ColumnCustomizerModal() {
  const {
    showColumnModal,
    setShowColumnModal,
    visibleColumns,
    toggleColumn,
    handleShowAllColumns,
    handleResetColumns
  } = useLeadFinder();

  if (!showColumnModal) return null;

  return (
    <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-[#0b0f19] border border-[#1e293b] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#1e293b]/70">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-xs font-bold text-white font-mono">Visible Columns</span>
          <span className="text-[10px] text-slate-400 font-mono">({visibleColumns.length} active)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShowAllColumns}
            className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            {visibleColumns.length === ALL_LEAD_COLUMNS.length ? "Defaults" : "All"}
          </button>
          <span className="text-slate-600">•</span>
          <button
            type="button"
            onClick={handleResetColumns}
            className="text-[10px] font-mono text-slate-400 hover:text-white cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setShowColumnModal(false)}
            className="ml-1 text-slate-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
        {ALL_LEAD_COLUMNS.map((col) => {
          const isChecked = visibleColumns.includes(col.id);
          return (
            <label
              key={col.id}
              className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
                isChecked
                  ? "bg-indigo-600/10 border-indigo-500/30 text-white"
                  : "bg-[#030712]/50 border-[#1e293b]/50 text-slate-400 hover:border-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleColumn(col.id)}
                className="rounded border-[#1e293b] bg-[#030712] text-indigo-600 focus:ring-indigo-500/20 h-3.5 w-3.5 cursor-pointer"
              />
              <span className="text-[11px] font-mono truncate">{col.label}</span>
            </label>
          );
        })}
      </div>

      <div className="mt-3 pt-2.5 border-t border-[#1e293b]/70 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>Changes saved automatically</span>
        <button
          onClick={() => setShowColumnModal(false)}
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold cursor-pointer transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
